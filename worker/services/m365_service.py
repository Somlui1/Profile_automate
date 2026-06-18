import logging
import urllib.request
import urllib.parse
import urllib.error
import json
from typing import List, Dict, Any, Optional
from core.config import settings

logger = logging.getLogger("app.services.m365_service")

class Microsoft365Service:
    """
    Handles connection to Microsoft Graph API to manage licenses.
    """
    def __init__(self):
        self.tenant_id = settings.M365_TENANT_ID
        self.client_id = settings.M365_CLIENT_ID
        self.client_secret = settings.M365_CLIENT_SECRET

        # Determine mock mode: respects SYSTEM_MODE or checks credentials
        if settings.SYSTEM_MODE == "mock":
            self.mock_mode = True
        else:
            self.mock_mode = not self.client_secret

        if self.mock_mode:
            logger.warning(
                "Microsoft 365 Service is running in MOCK MODE. "
                "Set M365_CLIENT_SECRET in .env to enable real Graph API integration."
            )

    def _get_access_token(self) -> str:
        """
        Retrieves OAuth2 access token for Microsoft Graph API.
        """
        if self.mock_mode:
            return "mock-token-123456"

        url = f"https://login.microsoftonline.com/{self.tenant_id}/oauth2/v2.0/token"
        data = {
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "scope": "https://graph.microsoft.com/.default",
            "grant_type": "client_credentials"
        }
        
        encoded_data = urllib.parse.urlencode(data).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=encoded_data,
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )

        try:
            with urllib.request.urlopen(req, timeout=10) as response:
                res = json.loads(response.read().decode("utf-8"))
                return res["access_token"]
        except urllib.error.HTTPError as e:
            error_body = e.read().decode("utf-8")
            logger.error(f"Failed to fetch Microsoft Graph access token: {e} - Detail: {error_body}")
            raise Exception(f"Microsoft Graph Auth Failed: {e} - Detail: {error_body}")
        except Exception as e:
            logger.error(f"Failed to fetch Microsoft Graph access token: {e}")
            raise Exception(f"Microsoft Graph Auth Failed: {e}")

    def check_user_exists(self, user_principal_name: str) -> bool:
        """
        Calls GET /users/{upn} via MS Graph to check if user exists.
        """
        if self.mock_mode:
            logger.info(f"[Mock MS Graph] check_user_exists: User {user_principal_name} exists")
            return True

        token = self._get_access_token()
        url = f"https://graph.microsoft.com/v1.0/users/{user_principal_name}"
        
        req = urllib.request.Request(
            url,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            },
            method="GET"
        )
        
        try:
            with urllib.request.urlopen(req, timeout=10) as response:
                return response.getcode() == 200
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return False
            error_body = e.read().decode("utf-8")
            logger.error(f"Failed to check user existence for {user_principal_name}: {e} - Detail: {error_body}")
            raise Exception(f"M365 User Existence Check Error: {e} - Detail: {error_body}")
        except Exception as e:
            logger.error(f"Failed to check user existence for {user_principal_name}: {e}")
            raise Exception(f"M365 User Existence Check Error: {e}")

    def set_usage_location(self, user_principal_name: str, usage_location: str) -> bool:
        """
        Calls PATCH /v1.0/users/{upn} via MS Graph to set usageLocation.
        """
        if self.mock_mode:
            logger.info(f"[Mock MS Graph] set_usage_location: Set {usage_location} for {user_principal_name}")
            return True

        token = self._get_access_token()
        url = f"https://graph.microsoft.com/v1.0/users/{user_principal_name}"
        payload = {"usageLocation": usage_location}
        encoded_payload = json.dumps(payload).encode("utf-8")
        
        req = urllib.request.Request(
            url,
            data=encoded_payload,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            },
            method="PATCH"
        )
        
        try:
            with urllib.request.urlopen(req, timeout=10) as response:
                status_code = response.getcode()
                if status_code in [200, 204]:
                    logger.info(f"Successfully set usageLocation to {usage_location} for {user_principal_name}")
                    return True
                else:
                    body = response.read().decode("utf-8")
                    logger.error(f"MS Graph returned status code {status_code} on PATCH usageLocation: {body}")
                    return False
        except urllib.error.HTTPError as e:
            error_body = e.read().decode("utf-8")
            logger.error(f"Failed to set usageLocation for {user_principal_name}: {e} - Detail: {error_body}")
            raise Exception(f"M365 Set Usage Location API Error: {e} - Detail: {error_body}")
        except Exception as e:
            logger.error(f"Failed to set usageLocation for {user_principal_name}: {e}")
            raise Exception(f"M365 Set Usage Location API Error: {e}")

    def get_user_usage_location(self, user_principal_name: str) -> Optional[str]:
        """
        Retrieves the usageLocation for a user from Microsoft Graph.
        """
        if self.mock_mode:
            return "TH"

        token = self._get_access_token()
        url = f"https://graph.microsoft.com/v1.0/users/{user_principal_name}?$select=usageLocation"
        
        req = urllib.request.Request(
            url,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            },
            method="GET"
        )
        
        try:
            with urllib.request.urlopen(req, timeout=10) as response:
                res = json.loads(response.read().decode("utf-8"))
                return res.get("usageLocation")
        except urllib.error.HTTPError as e:
            error_body = e.read().decode("utf-8")
            logger.error(f"Failed to fetch usageLocation for {user_principal_name}: {e} - Detail: {error_body}")
            return None
        except Exception as e:
            logger.error(f"Failed to fetch usageLocation for {user_principal_name}: {e}")
            return None

    def resolve_sku_ids(self, sku_list: List[Dict[str, str]]) -> List[Dict[str, str]]:
        """
        Converts SKU dicts with 'skuPartNumber' to include 'skuId' by querying MS Graph.
        """
        if self.mock_mode:
            import uuid
            resolved = []
            for sku in sku_list:
                if "skuId" in sku:
                    resolved.append(sku)
                else:
                    resolved.append({
                        "skuId": str(uuid.uuid4()),
                        "skuPartNumber": sku.get("skuPartNumber", "UNKNOWN")
                    })
            return resolved

        token = self._get_access_token()
        url = "https://graph.microsoft.com/v1.0/subscribedSkus"
        
        req = urllib.request.Request(
            url,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            },
            method="GET"
        )
        
        try:
            with urllib.request.urlopen(req, timeout=10) as response:
                res = json.loads(response.read().decode("utf-8"))
                skus_data = res.get("value", [])
                
                sku_map = {item.get("skuPartNumber"): item.get("skuId") for item in skus_data if item.get("skuPartNumber")}
                
                resolved = []
                for sku in sku_list:
                    if "skuId" in sku:
                        resolved.append(sku)
                    elif "skuPartNumber" in sku:
                        pn = sku["skuPartNumber"]
                        fallback_map = {
                            "EMS": "05e9a617-0261-4cee-9702-8cbcb002795e",
                            "STANDARDPACK": "c5928f49-12ba-48f7-ada3-0d743a3601d5"
                        }
                        if pn in sku_map:
                            resolved.append({"skuId": sku_map[pn], "skuPartNumber": pn})
                        elif pn in fallback_map:
                            resolved.append({"skuId": fallback_map[pn], "skuPartNumber": pn})
                        else:
                            logger.warning(f"SKU {pn} not found in subscribedSkus. Passing as is.")
                            resolved.append(sku)
                    else:
                        resolved.append(sku)
                return resolved
        except Exception as e:
            if isinstance(e, urllib.error.HTTPError):
                error_body = e.read().decode("utf-8")
                logger.error(f"Failed to fetch subscribedSkus: {e} - Detail: {error_body}")
            else:
                logger.error(f"Failed to fetch subscribedSkus: {e}")
            logger.warning("Using fallback SKU mapping due to error.")
            
            fallback_map = {
                "EMS": "05e9a617-0261-4cee-9702-8cbcb002795e",
                "STANDARDPACK": "c5928f49-12ba-48f7-ada3-0d743a3601d5"
            }
            resolved = []
            for sku in sku_list:
                if "skuId" in sku:
                    resolved.append(sku)
                elif "skuPartNumber" in sku:
                    pn = sku["skuPartNumber"]
                    if pn in fallback_map:
                        resolved.append({"skuId": fallback_map[pn], "skuPartNumber": pn})
                    else:
                        resolved.append(sku)
                else:
                    resolved.append(sku)
            return resolved

    def assign_licenses(self, user_principal_name: str, sku_list: List[Dict[str, str]]) -> bool:
        """
        Assigns M365 licenses to a user principal name via MS Graph.
        """
        if not sku_list:
            logger.info(f"No licenses to assign for user {user_principal_name}")
            return True

        if self.mock_mode:
            sku_names = [sku.get("skuPartNumber") or sku.get("skuId") or str(sku) for sku in sku_list]
            logger.info(f"[Mock MS Graph] Assigned licenses: {', '.join(sku_names)} to user {user_principal_name}")
            return True

        token = self._get_access_token()
        url = f"https://graph.microsoft.com/v1.0/users/{user_principal_name}/assignLicense"
        
        add_licenses = []
        for sku in sku_list:
            sku_id = sku.get("skuId")
            if sku_id:
                add_licenses.append({
                    "disabledPlans": [],
                    "skuId": sku_id
                })

        payload = {
            "addLicenses": add_licenses,
            "removeLicenses": []
        }

        encoded_payload = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=encoded_payload,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            },
            method="POST"
        )

        try:
            with urllib.request.urlopen(req, timeout=15) as response:
                status_code = response.getcode()
                if status_code in [200, 201, 204]:
                    logger.info(f"Successfully assigned {len(sku_list)} licenses to {user_principal_name}")
                    return True
                else:
                    body = response.read().decode("utf-8")
                    logger.error(f"MS Graph returned status code {status_code}: {body}")
                    return False
        except urllib.error.HTTPError as e:
            error_body = e.read().decode("utf-8")
            logger.error(f"Failed to assign M365 licenses for {user_principal_name}: {e} - Detail: {error_body}")
            raise Exception(f"M365 License Assignment API Error: {e} - Detail: {error_body}")
        except Exception as e:
            logger.error(f"Failed to assign M365 licenses for {user_principal_name}: {e}")
            raise Exception(f"M365 License Assignment API Error: {e}")

m365_service = Microsoft365Service()
