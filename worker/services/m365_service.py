import logging
import urllib.request
import urllib.parse
import json
from typing import List, Dict, Any
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
        except Exception as e:
            logger.error(f"Failed to fetch Microsoft Graph access token: {e}")
            raise Exception(f"Microsoft Graph Auth Failed: {e}")

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
        except Exception as e:
            logger.error(f"Failed to assign M365 licenses for {user_principal_name}: {e}")
            raise Exception(f"M365 License Assignment API Error: {e}")

m365_service = Microsoft365Service()
