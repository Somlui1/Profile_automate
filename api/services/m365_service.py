import logging
import requests
from core.config import settings

logger = logging.getLogger("app.services.m365")

class M365Service:
    def __init__(self):
        self.tenant_id = settings.M365_TENANT_ID
        self.client_id = settings.M365_CLIENT_ID
        self.client_secret = settings.M365_CLIENT_SECRET

    @property
    def mock_mode(self) -> bool:
        if settings.SYSTEM_MODE == "mock":
            return True
        return not (self.tenant_id and self.client_id and self.client_secret)

    def get_access_token(self) -> str:
        """Requests OAuth2 access token for Microsoft Graph API."""
        token_url = f"https://login.microsoftonline.com/{self.tenant_id}/oauth2/v2.0/token"
        payload = {
            "client_id": self.client_id,
            "scope": "https://graph.microsoft.com/.default",
            "client_secret": self.client_secret,
            "grant_type": "client_credentials",
        }
        try:
            response = requests.post(token_url, data=payload, timeout=3)
            response.raise_for_status()
            return response.json().get("access_token")
        except Exception as e:
            logger.error(f"Failed to retrieve M365 Access Token: {e}")
            return None

    def get_licenses(self) -> dict:
        """
        Fetches license inventory from Microsoft Graph API.
        If Graph API call fails or credentials are empty, returns rich mock data
        to guarantee a seamless fallback presentation.
        """
        if not self.mock_mode:
            access_token = self.get_access_token()
            
            if access_token:
                graph_url = "https://graph.microsoft.com/v1.0/subscribedSkus"
                headers = {
                    "Authorization": f"Bearer {access_token}",
                    "Accept": "application/json",
                }
                try:
                    response = requests.get(graph_url, headers=headers, timeout=3)
                    response.raise_for_status()
                    sku_data = response.json().get("value", [])
                    
                    if sku_data:
                        licenses = []
                        total_types = len(sku_data)
                        in_stock = 0
                        out_of_stock = 0
                        
                        for sku in sku_data:
                            sku_name = sku.get("skuPartNumber", "UNKNOWN_SKU")
                            total_units = sku.get("prepaidUnits", {}).get("enabled", 0)
                            consumed_units = sku.get("consumedUnits", 0)
                            available_units = max(0, total_units - consumed_units)
                            
                            status = "Available" if available_units > 0 else "Out of Stock"
                            if status == "Available":
                                in_stock += 1
                            else:
                                out_of_stock += 1
                                
                            licenses.append({
                                "skuId": sku.get("skuId"),
                                "skuPartNumber": sku_name,
                                "prepaidUnits": total_units,
                                "consumedUnits": consumed_units,
                                "availableUnits": available_units,
                                "status": status
                            })
                            
                        return {
                            "is_mock": False,
                            "summary": {
                                "total_product_types": total_types,
                                "in_stock": in_stock,
                                "out_of_stock": out_of_stock
                            },
                            "licenses": licenses
                        }
                except Exception as e:
                    logger.warning(f"Error fetching licenses from Microsoft Graph. Falling back to mock data: {e}")
        
        # Premium Fallback Mock Data: 18 items (10 Available / In Stock, 8 Out of Stock)
        mock_skus = [
            # In Stock (10 items)
            {"skuPartNumber": "ENTERPRISEPREMIUM", "total": 250, "consumed": 180},   # M365 Business Premium
            {"skuPartNumber": "SPE_E3", "total": 500, "consumed": 420},              # M365 E3
            {"skuPartNumber": "SPE_E5", "total": 100, "consumed": 85},               # M365 E5
            {"skuPartNumber": "O365_BUSINESS_ESSENTIALS", "total": 300, "consumed": 240}, # M365 Business Basic
            {"skuPartNumber": "DEVELOPER_PACK", "total": 25, "consumed": 5},         # Dev Pack
            {"skuPartNumber": "POWER_BI_PRO", "total": 150, "consumed": 120},        # Power BI Pro
            {"skuPartNumber": "VISIO_CLIENT", "total": 50, "consumed": 38},          # Visio Plan 2
            {"skuPartNumber": "PROJECT_CLIENT", "total": 40, "consumed": 32},        # Project Plan 3
            {"skuPartNumber": "WIN10_PRO_ENT_SUB", "total": 200, "consumed": 150},   # Windows E3
            {"skuPartNumber": "TEAMS_ESSENTIALS", "total": 80, "consumed": 45},       # Teams Essentials
            
            # Out of Stock (8 items)
            {"skuPartNumber": "OFFICE_365_E1", "total": 120, "consumed": 120},
            {"skuPartNumber": "OFFICE_365_E3", "total": 450, "consumed": 450},
            {"skuPartNumber": "DYN365_ENTERPRISE_CUSTOMER_SERVICE", "total": 15, "consumed": 15},
            {"skuPartNumber": "POWERAPPS_VIRAL", "total": 50, "consumed": 50},
            {"skuPartNumber": "FLOW_FREE", "total": 100, "consumed": 100},
            {"skuPartNumber": "STREAM", "total": 200, "consumed": 200},
            {"skuPartNumber": "ENTERPRISEPREMIUM_NOPROVISION", "total": 10, "consumed": 10},
            {"skuPartNumber": "VISIO_PRO_MOCK", "total": 5, "consumed": 5}
        ]
        
        licenses = []
        in_stock = 0
        out_of_stock = 0
        
        for i, mock in enumerate(mock_skus):
            available = max(0, mock["total"] - mock["consumed"])
            status = "Available" if available > 0 else "Out of Stock"
            if status == "Available":
                in_stock += 1
            else:
                out_of_stock += 1
                
            licenses.append({
                "skuId": f"mock-uuid-{i:04d}",
                "skuPartNumber": mock["skuPartNumber"],
                "prepaidUnits": mock["total"],
                "consumedUnits": mock["consumed"],
                "availableUnits": available,
                "status": status
            })
            
        return {
            "is_mock": True,
            "summary": {
                "total_product_types": len(mock_skus),
                "in_stock": in_stock,
                "out_of_stock": out_of_stock
            },
            "licenses": licenses
        }

m365_service = M365Service()
