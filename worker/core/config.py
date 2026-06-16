import os
from typing import List
from dotenv import load_dotenv

# Load settings from root .env
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
project_root = os.path.dirname(base_dir)
env_path = os.path.join(project_root, ".env")
load_dotenv(dotenv_path=env_path)

class Settings:
    # FastAPI Server
    HOST: str = os.getenv("HOST", "127.0.0.1")
    PORT: int = int(os.getenv("PORT", "8000"))
    
    # Active Directory / LDAP
    # AD_HOSTS supports comma-separated list of Domain Controller IPs for failover
    # e.g. "10.10.10.253,10.10.10.250"
    AD_HOSTS_RAW: str = os.getenv("AD_HOSTS", "")
    AD_USER: str = os.getenv("AD_USER", "")
    AD_PASSWORD: str = os.getenv("AD_PASSWORD", "")
    AD_BASE_DN: str = os.getenv("AD_BASE_DN", "DC=aapico,DC=com")
    AD_NEW_HIRE_OU: str = os.getenv("AD_NEW_HIRE_OU", "")
    AD_CONTRACT_OU: str = os.getenv("AD_CONTRACT_OU", "")

    @property
    def AD_HOSTS(self) -> List[str]:
        """Parse comma-separated AD_HOSTS into a list of host addresses."""
        if not self.AD_HOSTS_RAW:
            return []
        return [h.strip() for h in self.AD_HOSTS_RAW.split(",") if h.strip()]

    # --- Legacy aliases (backward compat) ---
    @property
    def LDAP_SERVER(self) -> str:
        return self.AD_HOSTS[0] if self.AD_HOSTS else ""

    @property
    def LDAP_USER(self) -> str:
        return self.AD_USER

    @property
    def LDAP_PASSWORD(self) -> str:
        return self.AD_PASSWORD

    @property
    def LDAP_BASE_DN(self) -> str:
        return self.AD_BASE_DN

    @property
    def LDAP_NEW_HIRE_OU(self) -> str:
        return self.AD_NEW_HIRE_OU

    @property
    def LDAP_CONTRACT_OU(self) -> str:
        return self.AD_CONTRACT_OU

    # Papercut API
    PAPERCUT_API_URL: str = os.getenv("PAPERCUT_API_URL", "")
    PAPERCUT_API_KEY: str = os.getenv("PAPERCUT_API_KEY", "")

    # Microsoft Graph API
    M365_TENANT_ID: str = os.getenv("M365_TENANT_ID", "a4722e58-ec99-4c3b-a34c-38620f1c4288")
    M365_CLIENT_ID: str = os.getenv("M365_CLIENT_ID", "ec1e5f36-4262-4ead-a5d7-9ab8892a950b")
    M365_CLIENT_SECRET: str = os.getenv("M365_CLIENT_SECRET", "")
    
    # Redis Configuration
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://redis:6379/0")
    FAKE_REDIS: str = os.getenv("FAKE_REDIS", "")
    MOCK_REDIS: bool = os.getenv("MOCK_REDIS", "true").lower() == "true"
    MOCK_REDIS_TYPE: str = os.getenv("MOCK_REDIS_TYPE", "file")
    MOCK_REDIS_PATH: str = os.getenv("MOCK_REDIS_PATH", "")

    @property
    def REDIS_MODE(self) -> str:
        if self.MOCK_REDIS:
            return "mock"
        return "live"

    # Job Configuration
    JOB_LOG_RETENTION_DAYS: int = int(os.getenv("JOB_LOG_RETENTION_DAYS", "30"))
    JOB_CANCEL_ROLLBACK_AD: bool = os.getenv("JOB_CANCEL_ROLLBACK_AD", "true").lower() == "true"
    
    # Database Configuration
    DB_PATH: str = os.getenv("DB_PATH", os.path.abspath(os.path.join(base_dir, "data", "jobs.db")))
    
    # System Mode (Dynamic Property: 'live', 'debug', 'mock')
    @property
    def SYSTEM_MODE(self) -> str:
        config_path = os.path.abspath(os.path.join(project_root, "api", "data", "system_config.json"))
        if os.path.exists(config_path):
            try:
                import json
                with open(config_path, "r") as f:
                    data = json.load(f)
                    if "SYSTEM_MODE" in data:
                        return data["SYSTEM_MODE"]
                    if "DEBUG_MODE" in data:
                        return "mock" if data["DEBUG_MODE"] else "live"
            except Exception:
                pass
        return os.getenv("SYSTEM_MODE", "mock").lower()

    @SYSTEM_MODE.setter
    def SYSTEM_MODE(self, val: str):
        if val not in ["live", "debug", "mock"]:
            raise ValueError("Invalid system mode. Must be 'live', 'debug', or 'mock'")
        config_path = os.path.abspath(os.path.join(project_root, "api", "data", "system_config.json"))
        os.makedirs(os.path.dirname(config_path), exist_ok=True)
        try:
            import json
            data = {}
            if os.path.exists(config_path):
                with open(config_path, "r") as f:
                    data = json.load(f)
            data["SYSTEM_MODE"] = val
            data["DEBUG_MODE"] = (val in ["debug", "mock"])
            with open(config_path, "w") as f:
                json.dump(data, f)
        except Exception as e:
            print(f"Failed to save SYSTEM_MODE settings: {e}")

    # Debug Mode (Derived from SYSTEM_MODE)
    @property
    def DEBUG_MODE(self) -> bool:
        return self.SYSTEM_MODE in ["debug", "mock"]

    @DEBUG_MODE.setter
    def DEBUG_MODE(self, val: bool):
        self.SYSTEM_MODE = "mock" if val else "live"

settings = Settings()
