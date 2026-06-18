import logging
from typing import Tuple, List, Dict, Any
from core.config import settings
from services.ad_service import ad_service
from services.m365_service import m365_service
from services.papercut_service import papercut_service
from core.redis_conn import redis_conn

logger = logging.getLogger("app.services.health_check")

class ServiceHealthChecker:
    def check_ad(self) -> Tuple[bool, str]:
        if ad_service.mock_mode:
            return True, "Mock mode - skipped"
        try:
            conn = ad_service._get_connection()
            if conn:
                conn.unbind()
            return True, "AD connection successful"
        except Exception as e:
            return False, f"AD connection failed: {e}"

    def check_m365(self) -> Tuple[bool, str]:
        if m365_service.mock_mode:
            return True, "Mock mode - skipped"
        try:
            m365_service._get_access_token()
            return True, "M365 Auth successful"
        except Exception as e:
            return False, f"M365 Auth failed: {e}"

    def check_papercut(self) -> Tuple[bool, str]:
        if papercut_service.mock_mode:
            return True, "Mock mode - skipped"
        try:
            papercut_service._server.api.getTotalUsers(papercut_service.auth_token)
            return True, "PaperCut XML-RPC successful"
        except Exception as e:
            return False, f"PaperCut connection failed: {e}"

    def check_redis(self) -> Tuple[bool, str]:
        if settings.SYSTEM_MODE in ["mock", "debug"]:
            return True, "Mock mode - skipped"
        try:
            if redis_conn:
                redis_conn.ping()
                return True, "Redis connection successful"
            else:
                return False, "Redis connection not initialized"
        except Exception as e:
            return False, f"Redis connection failed: {e}"

    def run_preflight(self, workflow_control: Dict[str, bool]) -> Tuple[bool, List[Dict[str, Any]]]:
        results = []
        all_passed = True

        ad_ok, ad_msg = self.check_ad()
        results.append({"service": "Active Directory", "passed": ad_ok, "message": ad_msg})
        if not ad_ok: all_passed = False

        redis_ok, redis_msg = self.check_redis()
        results.append({"service": "Redis", "passed": redis_ok, "message": redis_msg})
        if not redis_ok: all_passed = False

        if workflow_control.get("enable_papercut_sync", True):
            pc_ok, pc_msg = self.check_papercut()
            results.append({"service": "PaperCut", "passed": pc_ok, "message": pc_msg})
            if not pc_ok: all_passed = False

        if workflow_control.get("enable_microsoft_365_license", True):
            m365_ok, m365_msg = self.check_m365()
            results.append({"service": "Microsoft 365", "passed": m365_ok, "message": m365_msg})
            if not m365_ok: all_passed = False

        if workflow_control.get("enable_send_email", True):
            results.append({"service": "SMTP Email", "passed": True, "message": "Placeholder - skipped"})

        return all_passed, results

health_checker = ServiceHealthChecker()
