import logging
import xmlrpc.client
from core.config import settings
from core.exceptions import PapercutAPIError

logger = logging.getLogger("app.services.papercut_service")


class PapercutService:
    """
    Handles communication with PaperCut NG/MF via XML-RPC API.
    """

    def __init__(self):
        self.api_url = settings.PAPERCUT_API_URL
        self.auth_token = settings.PAPERCUT_API_KEY
        self._server = xmlrpc.client.ServerProxy(self.api_url) if self.api_url else None
        
        logger.info(f"Initialized PapercutService (mock_mode={self.mock_mode})")

    @property
    def mock_mode(self) -> bool:
        if settings.SYSTEM_MODE == "mock":
            return True
        return not (self.api_url and self.auth_token)

    # ------------------------------------------------------------------ #
    #  Primary Card
    # ------------------------------------------------------------------ #

    def set_user_primary_card(self, username: str, card_number: str) -> bool:
        """
        อัปเดตค่า Primary Card ของผู้ใช้ผ่าน api.setUserProperty

        Args:
            username:    sAMAccountName ของผู้ใช้ใน PaperCut
            card_number: เลขบัตรที่ต้องการตั้งค่า

        Returns:
            True เมื่อสำเร็จ

        Raises:
            PapercutAPIError: เมื่อ input ไม่ถูกต้อง หรือเกิดข้อผิดพลาดจาก PaperCut
        """
        if not username or not card_number:
            raise PapercutAPIError("Username and card_number are required.")

        if self.mock_mode:
            logger.info(f"[Mock PaperCut] Set primary card for '{username}' → {card_number}")
            return True

        try:
            logger.info(f"Setting primary card for user '{username}'...")
            result = self._server.api.setUserProperty(
                self.auth_token, username, "card-number", str(card_number)
            )
            if result:
                logger.info(f"Primary card set successfully for '{username}'.")
                return True
            else:
                raise PapercutAPIError(
                    f"PaperCut rejected setUserProperty for '{username}'. "
                    "Check user permissions or account status."
                )
        except xmlrpc.client.Fault as fault:
            raise PapercutAPIError(
                f"PaperCut API Fault ({fault.faultCode}): {fault.faultString}"
            )
        except PapercutAPIError:
            raise
        except Exception as e:
            raise PapercutAPIError(f"Connection error while setting primary card: {e}")

    # ------------------------------------------------------------------ #
    #  User / Group Sync
    # ------------------------------------------------------------------ #

    def force_user_sync(self) -> bool:
        """
        สั่ง Force Sync ทั่วทั้งระบบผ่าน api.performUserAndGroupSync
        (เทียบเท่าปุ่ม "Synchronize Now" ในหน้า Admin)

        Returns:
            True เมื่อสำเร็จ

        Raises:
            PapercutAPIError: เมื่อ PaperCut ปฏิเสธหรือเกิดข้อผิดพลาด
        """
        if self.mock_mode:
            logger.info("[Mock PaperCut] Force user/group sync triggered.")
            return True

        try:
            logger.info("Sending force user/group sync command...")
            result = self._server.api.performUserAndGroupSync(self.auth_token)
            if result:
                logger.info("User/group sync started successfully.")
                return True
            else:
                raise PapercutAPIError("PaperCut refused to start sync process.")
        except xmlrpc.client.Fault as fault:
            raise PapercutAPIError(
                f"PaperCut API Fault ({fault.faultCode}): {fault.faultString}"
            )
        except PapercutAPIError:
            raise
        except Exception as e:
            raise PapercutAPIError(f"Connection error while triggering sync: {e}")

    # ------------------------------------------------------------------ #
    #  Convenience: set card + sync in one call
    # ------------------------------------------------------------------ #

    def set_user_account_balance(
        self,
        username: str,
        balance: float = 100.0,
        comment: str = "Manual Reset via IT Script",
        account_name: str = "",
    ) -> bool:
        """
        ตั้งค่ายอดเงินคงเหลือของผู้ใช้ผ่าน api.setUserAccountBalance

        Args:
            username:     ชื่อผู้ใช้ที่ต้องการรีเซ็ต
            balance:      ยอดเงินที่ต้องการตั้งค่า (default: 100.0)
            comment:      ข้อความบันทึก (default: "Manual Reset via IT Script")
            account_name: ชื่อบัญชี (กระเป๋าเงิน) หากใส่ค่าว่าง "" จะปรับที่กระเป๋าเงินหลัก (Primary) (default: "")

        Returns:
            True เมื่อสำเร็จ
        """
        if not username:
            raise PapercutAPIError("Username is required.")

        if self.mock_mode:
            logger.info(
                f"[Mock PaperCut] Set balance for '{username}' → {balance} | Comment: {comment} | Account: {account_name}"
            )
            return True

        try:
            logger.info(f"Setting account balance for user '{username}' to {balance}...")
            result = self._server.api.setUserAccountBalance(
                self.auth_token, username, float(balance), comment, account_name
            )
            if result:
                logger.info(f"Account balance set successfully for '{username}'.")
                return True
            else:
                raise PapercutAPIError(
                    f"PaperCut rejected setUserAccountBalance for '{username}'."
                )
        except xmlrpc.client.Fault as fault:
            raise PapercutAPIError(
                f"PaperCut API Fault ({fault.faultCode}): {fault.faultString}"
            )
        except PapercutAPIError:
            raise
        except Exception as e:
            raise PapercutAPIError(f"Connection error while setting account balance: {e}")

    def set_card_and_sync(self, username: str, card_number: str) -> dict:
        """
        อัปเดต Primary Card แล้วสั่ง Force Sync ทันที

        Returns:
            dict สรุปผลลัพธ์ของทั้งสองขั้นตอน
        """
        card_ok = self.set_user_primary_card(username, card_number)
        sync_ok = self.force_user_sync()
        return {
            "username": username,
            "card_number": card_number,
            "card_updated": card_ok,
            "sync_triggered": sync_ok,
        }


# Module-level singleton (same pattern as ad_service)
papercut_service = PapercutService()
