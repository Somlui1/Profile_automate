import logging
from typing import Dict, Any, Tuple, List, Optional
from core.config import settings
from core.exceptions import ActiveDirectoryError

# Try importing ldap3
try:
    from ldap3 import Server, Connection, ServerPool, ALL, SUBTREE, LEVEL, MODIFY_REPLACE, ROUND_ROBIN, BASE
    LDAP_AVAILABLE = True
except ImportError:
    LDAP_AVAILABLE = False

logger = logging.getLogger("app.services.ad_service")

import time

class SimpleTTLCache:
    def __init__(self, ttl_seconds):
        self.ttl = ttl_seconds
        self.cache = {}
        
    def get(self, key):
        if key in self.cache:
            entry = self.cache[key]
            if time.time() - entry['time'] < self.ttl:
                return entry['data']
            else:
                del self.cache[key]
        return None
        
    def set(self, key, data):
        self.cache[key] = {'data': data, 'time': time.time()}

# Module-level cache for AD object details
_details_cache = SimpleTTLCache(60)


class ActiveDirectoryService:
    """
    Handles communication with Active Directory via LDAP/LDAPS.
    Supports multiple Domain Controllers with automatic failover.
    """
    def __init__(self, hosts: Optional[List[str]] = None, user: Optional[str] = None, password: Optional[str] = None, base_dn: Optional[str] = None):
        self.ad_hosts: List[str] = hosts if hosts is not None else settings.AD_HOSTS
        self.bind_dn: str = user if user is not None else settings.AD_USER
        self.bind_password: str = password if password is not None else settings.AD_PASSWORD
        self.base_dn: str = base_dn if base_dn is not None else settings.AD_BASE_DN
        
        self.new_hire_ou: str = settings.AD_NEW_HIRE_OU
        self.contract_ou: str = settings.AD_CONTRACT_OU
        
        # Determine if real AD connection works
        has_hosts = len(self.ad_hosts) > 0
        has_creds = bool(self.bind_dn and self.bind_password)
        self._real_ad_working = False
        
        if (has_hosts and has_creds) and LDAP_AVAILABLE:
            if settings.SYSTEM_MODE == "mock":
                logger.info("SYSTEM_MODE is 'mock'. Skipping real Active Directory connection test on startup.")
            else:
                try:
                    # Test connection to real AD using ignore_mock=True to bypass property check
                    conn = self._get_connection(ignore_mock=True)
                    if conn:
                        conn.unbind()
                    self._real_ad_working = True
                    logger.info("Successfully connected to real Active Directory LDAP.")
                except Exception as e:
                    logger.warning(
                        f"Could not connect to real Active Directory on startup: {e}. "
                        f"Set correct AD_HOSTS, AD_USER, and AD_PASSWORD in .env."
                    )
        
        if self.mock_mode:
            reason = []
            if not LDAP_AVAILABLE:
                reason.append("ldap3 library not installed")
            if not has_hosts:
                reason.append("AD_HOSTS not configured")
            if not has_creds:
                reason.append("AD_USER or AD_PASSWORD missing")
            if has_hosts and has_creds and LDAP_AVAILABLE and not self._real_ad_working:
                reason.append("AD server connection failed")
            logger.warning(
                f"Active Directory LDAP is running in MOCK MODE (SYSTEM_MODE={settings.SYSTEM_MODE}). "
                f"Reason: {', '.join(reason)}. "
            )
        else:
            logger.info(
                f"Active Directory configured with {len(self.ad_hosts)} host(s): "
                f"{', '.join(self.ad_hosts)} | Base DN: {self.base_dn}"
            )

    @property
    def mock_mode(self) -> bool:
        if settings.SYSTEM_MODE == "mock":
            return True
        has_hosts = len(self.ad_hosts) > 0
        has_creds = bool(self.bind_dn and self.bind_password)
        if not (has_hosts and has_creds) or not LDAP_AVAILABLE:
            return True
        return not self._real_ad_working

    def _get_connection(self, ignore_mock: bool = False) -> Any:
        """
        Establishes and returns an LDAP Connection object.
        Tries each host in AD_HOSTS in order (failover).
        """
        if self.mock_mode and not ignore_mock:
            return None

        import ssl
        from ldap3 import Tls
        tls_configuration = Tls(validate=ssl.CERT_NONE, version=ssl.PROTOCOL_TLSv1_2)

        # Build a ServerPool with all configured hosts for automatic failover
        servers = []
        for host in self.ad_hosts:
            if host.startswith("ldaps://"):
                server_url = host
                use_ssl = True
            elif host.startswith("ldap://"):
                server_url = host
                use_ssl = False
            else:
                server_url = f"ldaps://{host}:636"
                use_ssl = True
                
            try:
                if use_ssl:
                    servers.append(Server(server_url, port=636, use_ssl=True, tls=tls_configuration, get_info=ALL, connect_timeout=2))
                else:
                    servers.append(Server(server_url, get_info=ALL, connect_timeout=2))
            except Exception as e:
                logger.warning(f"Failed to initialize LDAP Server object for {host}: {e}")

        if not servers:
            raise ActiveDirectoryError("No valid LDAP servers could be initialized from AD_HOSTS")

        # Use ServerPool for failover: tries first server, if fails tries next
        pool = ServerPool(servers, ROUND_ROBIN, active=True, exhaust=True)
        
        try:
            conn = Connection(
                pool,
                user=self.bind_dn,
                password=self.bind_password,
                auto_bind=True,
                receive_timeout=3,
                check_names=False
            )
            logger.debug(f"LDAP connection established to: {conn.server.host}")
            return conn
        except Exception as e:
            hosts_str = ", ".join(self.ad_hosts)
            raise ActiveDirectoryError(
                f"Failed to connect to any LDAP Server ({hosts_str}): {str(e)}"
            )

    def check_user_exists(self, query: str, exact: bool = False) -> bool:
        """
        Check if a user exists in Active Directory.
        If exact=True, matches sAMAccountName exactly (e.g. for checking username taken).
        If exact=False, matches sAMAccountName, displayName, cn, mail, or anr (e.g. for checking manager exists).
        """
        if self.mock_mode:
            mock_users = ["existing_user", "anek phromsiri", "vipha jinda", "witthaya treeklee", "anek.ph", "witthaya"]
            q_clean = query.lower().strip()
            if exact:
                return q_clean in ["existing_user", "anek.ph"]
            else:
                return any(q_clean in u or u in q_clean for u in mock_users)

        conn = self._get_connection()
        try:
            if exact:
                search_filter = f"(sAMAccountName={query})"
            else:
                escaped = query.replace('\\', '\\5c').replace('*', '\\2a').replace('(', '\\28').replace(')', '\\29').replace('\x00', '\\00')
                search_filter = f"(&(objectClass=user)(|(sAMAccountName={escaped})(displayName={escaped})(cn={escaped})(mail={escaped})(anr={escaped})))"
            
            conn.search(
                search_base=self.base_dn,
                search_filter=search_filter,
                search_scope=SUBTREE,
                attributes=["sAMAccountName"]
            )
            return len(conn.entries) > 0
        except Exception as e:
            raise ActiveDirectoryError(f"Error checking user existence in AD: {str(e)}")
        finally:
            if conn:
                conn.unbind()

    def check_user_exists_with_username(self, query: str, exact: bool = False) -> Tuple[bool, Optional[str]]:
        """
        Check if a user exists and returns (exists, sAMAccountName).
        """
        if self.mock_mode:
            mock_mapping = {
                "existing_user": "existing_user",
                "anek.ph": "anek.ph",
                "anek phromsiri": "anek.ph",
                "vipha jinda": "vipha.j",
                "witthaya treeklee": "witthaya.t",
                "witthaya": "witthaya.t",
                "mr. somchai": "somchai.m",
                "somchai": "somchai.m"
            }
            q_clean = query.lower().strip()
            
            # Direct match
            if q_clean in mock_mapping:
                return True, mock_mapping[q_clean]
                
            # Partial match
            for k, v in mock_mapping.items():
                if q_clean in k or k in q_clean:
                    return True, v
            return False, None

        conn = self._get_connection()
        try:
            if exact:
                search_filter = f"(sAMAccountName={query})"
            else:
                escaped = query.replace('\\', '\\5c').replace('*', '\\2a').replace('(', '\\28').replace(')', '\\29').replace('\x00', '\\00')
                search_filter = f"(&(objectClass=user)(|(sAMAccountName={escaped})(displayName={escaped})(cn={escaped})(mail={escaped})(anr={escaped})))"
            
            conn.search(
                search_base=self.base_dn,
                search_filter=search_filter,
                search_scope=SUBTREE,
                attributes=["sAMAccountName"]
            )
            if len(conn.entries) > 0:
                try:
                    s_name = str(conn.entries[0].sAMAccountName.value)
                    return True, s_name
                except Exception:
                    return True, query
            return False, None
        except Exception as e:
            raise ActiveDirectoryError(f"Error checking user existence in AD: {str(e)}")
        finally:
            if conn:
                conn.unbind()

    def extract_first_last_name(self, name_english: str) -> Tuple[str, str]:
        """Extracts first and last name from English name."""
        clean_name = name_english.replace("Mr. ", "").replace("Ms. ", "").replace("Mrs. ", "").strip()
        parts = clean_name.split()
        first_name = parts[0] if parts else ""
        last_name = " ".join(parts[1:]) if len(parts) > 1 else ""
        return first_name, last_name

    def get_ad_tree(self, parent_dn: str = None) -> list:
        """
        Gets immediate children of a given DN in Active Directory tree.
        """
        if not parent_dn:
            parent_dn = self.base_dn or "DC=aapico,DC=com"
            
        if self.mock_mode:
            parent_dn_lower = parent_dn.lower().replace(" ", "")
            # Domain Root
            if parent_dn_lower in ["dc=aapico,dc=com", ""]:
                return [
                    {"dn": "CN=Builtin,DC=aapico,DC=com", "name": "Builtin", "type": "container", "has_children": True},
                    {"dn": "CN=Computers,DC=aapico,DC=com", "name": "Computers", "type": "container", "has_children": True},
                    {"dn": "OU=Domain Controllers,DC=aapico,DC=com", "name": "Domain Controllers", "type": "ou", "has_children": True},
                    {"dn": "OU=Groups,DC=aapico,DC=com", "name": "Groups", "type": "container", "has_children": True},
                    {"dn": "OU=Service Accounts,DC=aapico,DC=com", "name": "Service Accounts", "type": "ou", "has_children": True},
                    {"dn": "OU=Users,DC=aapico,DC=com", "name": "Users", "type": "container", "has_children": True},
                ]
            # Builtin container
            elif parent_dn_lower == "cn=builtin,dc=aapico,dc=com":
                return [
                    {"dn": "CN=Administrators,CN=Builtin,DC=aapico,DC=com", "name": "Administrators", "type": "group", "has_children": False},
                    {"dn": "CN=Backup Operators,CN=Builtin,DC=aapico,DC=com", "name": "Backup Operators", "type": "group", "has_children": False},
                    {"dn": "CN=Print Operators,CN=Builtin,DC=aapico,DC=com", "name": "Print Operators", "type": "group", "has_children": False},
                    {"dn": "CN=Remote Desktop Users,CN=Builtin,DC=aapico,DC=com", "name": "Remote Desktop Users", "type": "group", "has_children": False},
                    {"dn": "CN=Users,CN=Builtin,DC=aapico,DC=com", "name": "Users", "type": "group", "has_children": False},
                ]
            # Computers container
            elif parent_dn_lower == "cn=computers,dc=aapico,dc=com":
                return [
                    {"dn": "CN=PC-ENG-001,CN=Computers,DC=aapico,DC=com", "name": "PC-ENG-001", "type": "computer", "has_children": False},
                    {"dn": "CN=PC-HR-001,CN=Computers,DC=aapico,DC=com", "name": "PC-HR-001", "type": "computer", "has_children": False},
                    {"dn": "CN=PC-MKT-001,CN=Computers,DC=aapico,DC=com", "name": "PC-MKT-001", "type": "computer", "has_children": False},
                    {"dn": "CN=LAPTOP-IT-001,CN=Computers,DC=aapico,DC=com", "name": "LAPTOP-IT-001", "type": "computer", "has_children": False},
                ]
            # Domain Controllers
            elif parent_dn_lower == "ou=domaincontrollers,dc=aapico,dc=com":
                return [
                    {"dn": "CN=DC01,OU=Domain Controllers,DC=aapico,DC=com", "name": "DC01", "type": "computer", "has_children": False},
                    {"dn": "CN=DC02,OU=Domain Controllers,DC=aapico,DC=com", "name": "DC02", "type": "computer", "has_children": False},
                ]
            # Service Accounts
            elif parent_dn_lower == "ou=serviceaccounts,dc=aapico,dc=com":
                return [
                    {"dn": "CN=svc-papercut,OU=Service Accounts,DC=aapico,DC=com", "name": "svc-papercut", "type": "user", "has_children": False},
                    {"dn": "CN=svc-backup,OU=Service Accounts,DC=aapico,DC=com", "name": "svc-backup", "type": "user", "has_children": False},
                    {"dn": "CN=svc-exchange,OU=Service Accounts,DC=aapico,DC=com", "name": "svc-exchange", "type": "user", "has_children": False},
                ]
            # Users container (top-level)
            elif parent_dn_lower == "ou=users,dc=aapico,dc=com":
                return [
                    {"dn": "OU=contract,OU=Users,DC=aapico,DC=com", "name": "contract", "type": "ou", "has_children": True},
                    {"dn": "OU=Engineering,OU=Users,DC=aapico,DC=com", "name": "Engineering", "type": "ou", "has_children": True},
                    {"dn": "OU=Human Resources,OU=Users,DC=aapico,DC=com", "name": "Human Resources", "type": "ou", "has_children": True},
                    {"dn": "OU=Information Technology,OU=Users,DC=aapico,DC=com", "name": "Information Technology", "type": "ou", "has_children": True},
                    {"dn": "OU=Marketing,OU=Users,DC=aapico,DC=com", "name": "Marketing", "type": "ou", "has_children": True},
                    {"dn": "OU=newhire,OU=Users,DC=aapico,DC=com", "name": "newhire", "type": "ou", "has_children": True},
                    {"dn": "OU=Production,OU=Users,DC=aapico,DC=com", "name": "Production", "type": "ou", "has_children": True},
                    {"dn": "CN=Administrator,OU=Users,DC=aapico,DC=com", "name": "Administrator", "type": "user", "has_children": False},
                    {"dn": "CN=Vipha Jinda,OU=Users,DC=aapico,DC=com", "name": "Vipha Jinda", "type": "user", "has_children": False},
                    {"dn": "CN=External Consultant,OU=Users,DC=aapico,DC=com", "name": "External Consultant", "type": "contact", "has_children": False},
                    {"dn": "CN=Finance Share,OU=Users,DC=aapico,DC=com", "name": "Finance Shared Folder", "type": "sharedfolder", "has_children": False},
                    {"dn": "CN=HR-Printer,OU=Users,DC=aapico,DC=com", "name": "HR Color Printer", "type": "printer", "has_children": False},
                ]
            # Engineering OU
            elif parent_dn_lower == "ou=engineering,ou=users,dc=aapico,dc=com":
                return [
                    {"dn": "OU=Cloud Team,OU=Engineering,OU=Users,DC=aapico,DC=com", "name": "Cloud Team", "type": "ou", "has_children": True},
                    {"dn": "OU=DevOps,OU=Engineering,OU=Users,DC=aapico,DC=com", "name": "DevOps", "type": "ou", "has_children": True},
                    {"dn": "CN=Anek Phromsiri,OU=Engineering,OU=Users,DC=aapico,DC=com", "name": "Anek Phromsiri", "type": "user", "has_children": False},
                    {"dn": "CN=Krit Suwannarat,OU=Engineering,OU=Users,DC=aapico,DC=com", "name": "Krit Suwannarat", "type": "user", "has_children": False},
                ]
            # Cloud Team sub-OU
            elif parent_dn_lower == "ou=cloudteam,ou=engineering,ou=users,dc=aapico,dc=com":
                return [
                    {"dn": "CN=Nattapong Chaiyasit,OU=Cloud Team,OU=Engineering,OU=Users,DC=aapico,DC=com", "name": "Nattapong Chaiyasit", "type": "user", "has_children": False},
                    {"dn": "CN=Piyanat Tongkham,OU=Cloud Team,OU=Engineering,OU=Users,DC=aapico,DC=com", "name": "Piyanat Tongkham", "type": "user", "has_children": False},
                ]
            # DevOps sub-OU
            elif parent_dn_lower == "ou=devops,ou=engineering,ou=users,dc=aapico,dc=com":
                return [
                    {"dn": "CN=Thanakorn Jitkaew,OU=DevOps,OU=Engineering,OU=Users,DC=aapico,DC=com", "name": "Thanakorn Jitkaew", "type": "user", "has_children": False},
                ]
            # Human Resources OU
            elif parent_dn_lower == "ou=humanresources,ou=users,dc=aapico,dc=com":
                return [
                    {"dn": "CN=Wanida Srisai,OU=Human Resources,OU=Users,DC=aapico,DC=com", "name": "Wanida Srisai", "type": "user", "has_children": False},
                    {"dn": "CN=Ploy Thammasak,OU=Human Resources,OU=Users,DC=aapico,DC=com", "name": "Ploy Thammasak", "type": "user", "has_children": False},
                ]
            # Information Technology OU
            elif parent_dn_lower == "ou=informationtechnology,ou=users,dc=aapico,dc=com":
                return [
                    {"dn": "OU=Helpdesk,OU=Information Technology,OU=Users,DC=aapico,DC=com", "name": "Helpdesk", "type": "ou", "has_children": True},
                    {"dn": "CN=Wajeepradit P.,OU=Information Technology,OU=Users,DC=aapico,DC=com", "name": "Wajeepradit P.", "type": "user", "has_children": False},
                    {"dn": "CN=Surachai Intakan,OU=Information Technology,OU=Users,DC=aapico,DC=com", "name": "Surachai Intakan", "type": "user", "has_children": False},
                ]
            # Helpdesk sub-OU
            elif parent_dn_lower == "ou=helpdesk,ou=informationtechnology,ou=users,dc=aapico,dc=com":
                return [
                    {"dn": "CN=Pongsakorn Meesuk,OU=Helpdesk,OU=Information Technology,OU=Users,DC=aapico,DC=com", "name": "Pongsakorn Meesuk", "type": "user", "has_children": False},
                ]
            # Marketing OU
            elif parent_dn_lower == "ou=marketing,ou=users,dc=aapico,dc=com":
                return [
                    {"dn": "CN=Siriporn Chanvong,OU=Marketing,OU=Users,DC=aapico,DC=com", "name": "Siriporn Chanvong", "type": "user", "has_children": False},
                ]
            # newhire OU
            elif parent_dn_lower == "ou=newhire,ou=users,dc=aapico,dc=com":
                return [
                    {"dn": "CN=Somchai Kornthong,OU=newhire,OU=Users,DC=aapico,DC=com", "name": "Somchai Kornthong", "type": "user", "has_children": False},
                    {"dn": "CN=Ratana Sriburin,OU=newhire,OU=Users,DC=aapico,DC=com", "name": "Ratana Sriburin", "type": "user", "has_children": False},
                ]
            # contract OU
            elif parent_dn_lower == "ou=contract,ou=users,dc=aapico,dc=com":
                return [
                    {"dn": "CN=Pailin Kamolrat,OU=contract,OU=Users,DC=aapico,DC=com", "name": "Pailin Kamolrat", "type": "user", "has_children": False},
                ]
            # Production OU
            elif parent_dn_lower == "ou=production,ou=users,dc=aapico,dc=com":
                return [
                    {"dn": "OU=Line A,OU=Production,OU=Users,DC=aapico,DC=com", "name": "Line A", "type": "ou", "has_children": True},
                    {"dn": "OU=Line B,OU=Production,OU=Users,DC=aapico,DC=com", "name": "Line B", "type": "ou", "has_children": True},
                    {"dn": "CN=Sakchai Wongprasert,OU=Production,OU=Users,DC=aapico,DC=com", "name": "Sakchai Wongprasert", "type": "user", "has_children": False},
                ]
            # Production Line A sub-OU
            elif parent_dn_lower == "ou=linea,ou=production,ou=users,dc=aapico,dc=com":
                return [
                    {"dn": "CN=Manop Srisuk,OU=Line A,OU=Production,OU=Users,DC=aapico,DC=com", "name": "Manop Srisuk", "type": "user", "has_children": False},
                    {"dn": "CN=Chaiwat Boonchu,OU=Line A,OU=Production,OU=Users,DC=aapico,DC=com", "name": "Chaiwat Boonchu", "type": "user", "has_children": False},
                ]
            # Production Line B sub-OU
            elif parent_dn_lower == "ou=lineb,ou=production,ou=users,dc=aapico,dc=com":
                return [
                    {"dn": "CN=Supachai Kaewdee,OU=Line B,OU=Production,OU=Users,DC=aapico,DC=com", "name": "Supachai Kaewdee", "type": "user", "has_children": False},
                ]
            # Groups container
            elif parent_dn_lower == "ou=groups,dc=aapico,dc=com":
                return [
                    {"dn": "OU=Security Groups,OU=Groups,DC=aapico,DC=com", "name": "Security Groups", "type": "ou", "has_children": True},
                    {"dn": "OU=Distribution Lists,OU=Groups,DC=aapico,DC=com", "name": "Distribution Lists", "type": "ou", "has_children": True},
                    {"dn": "CN=Domain Admins,OU=Groups,DC=aapico,DC=com", "name": "Domain Admins", "type": "group", "has_children": False},
                    {"dn": "CN=Domain Users,OU=Groups,DC=aapico,DC=com", "name": "Domain Users", "type": "group", "has_children": False},
                ]
            # Security Groups sub-OU
            elif parent_dn_lower == "ou=securitygroups,ou=groups,dc=aapico,dc=com":
                return [
                    {"dn": "CN=IT Admins,OU=Security Groups,OU=Groups,DC=aapico,DC=com", "name": "IT Admins", "type": "group", "has_children": False},
                    {"dn": "CN=VPN Users,OU=Security Groups,OU=Groups,DC=aapico,DC=com", "name": "VPN Users", "type": "group", "has_children": False},
                    {"dn": "CN=Engineering Users,OU=Security Groups,OU=Groups,DC=aapico,DC=com", "name": "Engineering Users", "type": "group", "has_children": False},
                    {"dn": "CN=HR Staff,OU=Security Groups,OU=Groups,DC=aapico,DC=com", "name": "HR Staff", "type": "group", "has_children": False},
                ]
            # Distribution Lists sub-OU
            elif parent_dn_lower == "ou=distributionlists,ou=groups,dc=aapico,dc=com":
                return [
                    {"dn": "CN=All Staff,OU=Distribution Lists,OU=Groups,DC=aapico,DC=com", "name": "All Staff", "type": "group", "has_children": False},
                    {"dn": "CN=Management Team,OU=Distribution Lists,OU=Groups,DC=aapico,DC=com", "name": "Management Team", "type": "group", "has_children": False},
                ]
            return []

        conn = self._get_connection()
        try:
            conn.search(
                search_base=parent_dn,
                search_filter="(|(objectClass=organizationalUnit)(objectClass=container)(objectClass=builtinDomain)(objectClass=systemContainer)(objectClass=lostAndFound)(objectClass=user)(objectClass=group)(objectClass=contact)(objectClass=volume)(objectClass=printQueue))",
                search_scope=LEVEL,
                attributes=["objectClass", "ou", "cn", "distinguishedName", "description", "title", "department", "mail", "company"]
            )
            
            results = []
            
            def safe_get_tree(entry_obj, attr_name, default=""):
                try:
                    if hasattr(entry_obj, attr_name):
                        attr = getattr(entry_obj, attr_name)
                        if attr and attr.value:
                            if isinstance(attr.value, list):
                                return str(attr.value[0]) if attr.value else default
                            return str(attr.value)
                except Exception:
                    pass
                return default
                
            for entry in conn.entries:
                classes = entry.objectClass.values
                dn = entry.entry_dn
                
                node_type = "user"
                has_children = False
                
                if "domain" in classes or "domainDNS" in classes:
                    node_type = "domain"
                elif "organizationalUnit" in classes:
                    node_type = "ou"
                elif "container" in classes or "builtinDomain" in classes or "systemContainer" in classes or "lostAndFound" in classes:
                    node_type = "container"
                elif "group" in classes:
                    node_type = "group"
                elif "computer" in classes:
                    node_type = "computer"
                elif "contact" in classes:
                    node_type = "contact"
                elif "volume" in classes:
                    node_type = "sharedfolder"
                elif "printQueue" in classes:
                    node_type = "printer"
                elif "user" in classes or "person" in classes:
                    node_type = "user"
                    
                has_children = False
                if node_type in ["ou", "container"]:
                    try:
                        # Perform a level search to see if there are any child elements under this node
                        conn.search(
                            search_base=dn,
                            search_filter="(|(objectClass=organizationalUnit)(objectClass=container)(objectClass=builtinDomain)(objectClass=systemContainer)(objectClass=lostAndFound)(objectClass=user)(objectClass=group)(objectClass=contact)(objectClass=volume)(objectClass=printQueue))",
                            search_scope=LEVEL,
                            attributes=["distinguishedName"]
                        )
                        if conn.entries:
                            has_children = True
                    except Exception as child_err:
                        logger.warning(f"Failed to check children for {dn}: {child_err}")
                    
                name = ""
                if hasattr(entry, 'cn') and entry.cn.value:
                    name = entry.cn.value
                elif hasattr(entry, 'ou') and entry.ou.value:
                    name = entry.ou.value
                else:
                    parts = dn.split(',')
                    if parts:
                        name_parts = parts[0].split('=')
                        if len(name_parts) > 1:
                            name = name_parts[1]
                
                if not name:
                    name = dn
                    
                results.append({
                    "dn": dn,
                    "name": name,
                    "type": node_type,
                    "has_children": has_children,
                    "description": safe_get_tree(entry, "description"),
                    "title": safe_get_tree(entry, "title"),
                    "department": safe_get_tree(entry, "department"),
                    "mail": safe_get_tree(entry, "mail"),
                    "company": safe_get_tree(entry, "company")
                })
                
            # Sort: containers/OUs first (alphabetically), then other objects (alphabetically)
            results.sort(key=lambda x: (x["type"] not in ["ou", "container"], x["name"].lower()))
            return results
        except Exception as e:
            raise ActiveDirectoryError(f"Error listing children for {parent_dn} in AD: {str(e)}")
        finally:
            if conn:
                conn.unbind()

    def get_user_details(self, dn: str) -> Optional[dict]:
        """
        Gets detailed attributes of a user in Active Directory.
        """
        cached_data = _details_cache.get(dn)
        if cached_data:
            return cached_data

        try:
            import re
            dn_parts = re.split(r'(?<!\\),', dn)
            cn_part = dn_parts[0] if dn_parts else ''
            raw_name = cn_part[3:].replace('\\\\,', ',').replace('\\,', ',').strip() if cn_part.upper().startswith('CN=') else cn_part.replace('\\\\,', ',').replace('\\,', ',').strip()
            parent_ou = ",".join(dn_parts[1:]) if len(dn_parts) > 1 else f"OU=Users,{self.base_dn}"

            if self.mock_mode:
                # 1. Try to search sqlite database for a matching sync job
                db_user_details = None
                try:
                    import json
                    from core.database import get_db_connection
                    conn_db = get_db_connection()
                    cursor = conn_db.cursor()
                    cursor.execute('SELECT payload FROM jobs')
                    rows = cursor.fetchall()
                    conn_db.close()
                    
                    def clean_name_str(s):
                        return re.sub(r'^(mr\.|ms\.|mrs\.|dr\.|mr|ms|mrs|dr)\s+', '', s, flags=re.IGNORECASE).strip()
                    
                    clean_target = clean_name_str(raw_name).lower()
                    
                    for row in rows:
                        try:
                            payload = json.loads(row['payload'])
                            req_info = payload.get('requester_info') or {}
                            name_eng = req_info.get('name_english', '')
                            if clean_name_str(name_eng).lower() == clean_target:
                                custom_attrs = payload.get('custom_attributes') or {}
                                task_data = payload.get('task_data') or {}
                                ad_profile = task_data.get('ad_profile') or {}
                                papercut_profile = task_data.get('papercut_profile') or {}
                                
                                uid = ad_profile.get('custom_username') or payload.get('custom_username')
                                if not uid:
                                    first_p, last_p = self.extract_first_last_name(name_eng)
                                    uid = f"{first_p.lower()}.{last_p[0].lower()}" if last_p else first_p.lower()
                                    
                                print_code = papercut_profile.get('print_code') or payload.get('custom_print_code') or "990011"
                                
                                db_user_details = {
                                    "uid": uid,
                                    "name": name_eng,
                                    "email": custom_attrs.get('email') or f"{uid}@aapico.com",
                                    "title": req_info.get('position', 'Staff Member'),
                                    "dept": req_info.get('department', 'Operations'),
                                    "printCode": print_code,
                                    "ou": parent_ou,
                                    "papercut": "Synced",
                                    "status": "Active",
                                    "mobile": req_info.get('mobile_phone', '+66 (0) 81 234 5678'),
                                    "company": req_info.get('company', 'AAPICO Hitech PLC'),
                                    "manager": req_info.get('supervisor_name', 'Somsak Sombat'),
                                    "office": req_info.get('office', 'AAPICO HQ - Building A'),
                                    "description": req_info.get('employee_id', 'Auto Synced Active Directory Object'),
                                    "street": req_info.get('address', '99 Moo 1 Hitech Industrial Estate, Tambol Ban Len'),
                                    "city": 'Bang Pa-In',
                                    "state": 'Phranakhon Sri Ayutthaya',
                                    "zipCode": req_info.get('zip_code', '13160'),
                                    "country": 'Thailand',
                                    "givenName": name_eng.split(' ')[0],
                                    "sn": " ".join(name_eng.split(' ')[1:]) if len(name_eng.split(' ')) > 1 else "",
                                    "displayName": name_eng,
                                    "userPrincipalName": f"{uid}@aapico.com",
                                    "sAMAccountName": uid,
                                    "userAccountControl": 512,
                                    "pwdNeverExpires": False,
                                    "acctDisabled": False,
                                    "mustChangePwd": True,
                                    "memberOf": ["Domain Users"],
                                    "employeeID": req_info.get('employee_id', ''),
                                    "employeeType": "Regular",
                                    "scriptPath": "logon.bat",
                                    "homeDirectory": f"\\\\server\\users\\{uid}",
                                    "extensionAttributes": {}
                                }
                                break
                        except Exception as inner_e:
                            logger.error(f"Error parsing job payload during AD match: {inner_e}")
                except Exception as db_e:
                    logger.error(f"Database query failed during AD user details mock: {db_e}")
                
                if db_user_details:
                    return db_user_details

                # 2. Generate mock details based on DN/name
                name = raw_name
                first_name, last_name = self.extract_first_last_name(name)
                uid = f"{first_name.lower()}.{last_name[0].lower()}" if last_name else first_name.lower()
                
                # Simple mock attributes mapping
                dept = "Information Technology" if "Information Technology" in dn or "Helpdesk" in dn else \
                       "Engineering" if "Engineering" in dn or "Cloud" in dn or "DevOps" in dn else \
                       "Human Resources" if "Human" in dn else \
                       "Marketing" if "Marketing" in dn else \
                       "Production" if "Production" in dn else "Operations"
                       
                title = "Staff Member"
                email = f"{uid}@aapico.com"
                print_code = "990011"
                if "Administrator" in name:
                    title = "Domain Administrator"
                    uid = "Administrator"
                elif "Vipha" in name:
                    title = "VP of HR & Admin"
                    dept = "Human Resources"
                    uid = "vipha.ji"
                    email = "vipha.j@aapico.com"
                    print_code = "998811"
                elif "Anek" in name:
                    title = "Director of Engineering"
                    dept = "Engineering"
                    uid = "anek.ph"
                    email = "anek.p@aapico.com"
                    print_code = "112233"
                elif "Somsak" in name:
                    title = "IT Operations Manager"
                    dept = "Information Technology"
                    uid = "somsak.so"
                    email = "somsak.s@aapico.com"
                    print_code = "445566"

                return {
                    "uid": uid,
                    "name": name,
                    "email": email,
                    "title": title,
                    "dept": dept,
                    "printCode": print_code,
                    "ou": parent_ou,
                    "papercut": "Synced",
                    "status": "Active",
                    "mobile": "+66 (0) 81 234 5678",
                    "company": "AAPICO Hitech PLC",
                    "manager": "Somsak Sombat",
                    "office": "AAPICO HQ - Building A",
                    "description": "Auto Synced Active Directory Object",
                    "street": "99 Moo 1 Hitech Industrial Estate, Tambol Ban Len",
                    "city": "Bang Pa-In",
                    "state": "Phranakhon Sri Ayutthaya",
                    "zipCode": "13160",
                    "country": "Thailand",
                    "givenName": first_name,
                    "initials": "",
                    "sn": last_name,
                    "displayName": name,
                    "telephoneNumber": "035-350880",
                    "userPrincipalName": f"{uid}@aapico.com",
                    "sAMAccountName": uid,
                    "userAccountControl": 512,
                    "pwdNeverExpires": False,
                    "acctDisabled": False,
                    "mustChangePwd": True,
                    "pwdLastSet": "0",
                    "profilePath": "",
                    "scriptPath": "logon.bat",
                    "homeDirectory": f"\\\\server\\users\\{uid}",
                    "homeDrive": "H:",
                    "memberOf": ["Domain Users", "VPN Users"],
                    "employeeID": "E99000",
                    "employeeType": "Regular",
                    "mailNickname": uid,
                    "extensionAttributes": {
                        "extensionAttribute1": "TH",
                        "extensionAttribute2": "CostCenter:1001"
                    }
                }

            conn = self._get_connection()
            try:
                conn.search(
                    search_base=dn,
                    search_filter="(objectClass=user)",
                    search_scope=BASE,
                    attributes=[
                        "sAMAccountName", "displayName", "givenName", "initials", "sn", "description", 
                        "physicalDeliveryOfficeName", "telephoneNumber", "otherTelephone", "mail", "wWWHomePage",
                        "streetAddress", "postOfficeBox", "l", "st", "postalCode", "co", 
                        "userPrincipalName", "userAccountControl", "pwdLastSet", "accountExpires", "logonHours",
                        "profilePath", "scriptPath", "homeDirectory", "homeDrive",
                        "homePhone", "pager", "mobile", "facsimileTelephoneNumber", "ipPhone", "info",
                        "title", "department", "company", "manager", "memberOf", "employeeID", "employeeType", "mailNickname",
                        "extensionAttribute1", "extensionAttribute2", "extensionAttribute3", "extensionAttribute4", "extensionAttribute5",
                        "extensionAttribute6", "extensionAttribute7", "extensionAttribute8", "extensionAttribute9", "extensionAttribute10",
                        "extensionAttribute11", "extensionAttribute12", "extensionAttribute13", "extensionAttribute14", "extensionAttribute15"
                    ]
                )
                if not conn.entries:
                    return None
                    
                entry = conn.entries[0]
                
                # Helper function for safe attribute extraction
                def safe_get(attr_name, default=""):
                    try:
                        if hasattr(entry, attr_name):
                            attr = getattr(entry, attr_name)
                            if attr and attr.value:
                                if isinstance(attr.value, list):
                                    return str(attr.value[0]) if attr.value else default
                                return str(attr.value)
                    except Exception:
                        pass
                    return default
                
                manager_val = ""
                mgr_dn = safe_get("manager")
                if mgr_dn:
                    if "cn=" in mgr_dn.lower():
                        mgr_parts = re.split(r'(?<!\\),', mgr_dn)
                        mgr_cn_parts = [p for p in mgr_parts if p.lower().startswith("cn=")]
                        if mgr_cn_parts:
                            manager_val = mgr_cn_parts[0].split("=")[1].replace('\\\\,', ',').replace('\\,', ',').strip()
                    if not manager_val:
                        manager_val = mgr_dn
                
                uac_str = safe_get("userAccountControl")
                try:
                    uac = int(uac_str) if uac_str else 512
                except ValueError:
                    uac = 512
                # extract memberOf correctly
                member_of_list = []
                try:
                    if hasattr(entry, 'memberOf') and entry.memberOf.value:
                        for grp_dn in entry.memberOf.value:
                            grp_parts = re.split(r'(?<!\\),', str(grp_dn))
                            grp_cn_parts = [p for p in grp_parts if p.upper().startswith("CN=")]
                            if grp_cn_parts:
                                member_of_list.append(grp_cn_parts[0].split("=", 1)[1].replace('\\\\,', ',').replace('\\,', ',').strip())
                            else:
                                member_of_list.append(str(grp_dn))
                except Exception as e:
                    logger.warning(f"Failed to parse memberOf for {dn}: {e}")

                status = "Disabled" if uac & 2 else "Active"
                pwd_never_expires = bool(uac & 65536)
                acct_disabled = bool(uac & 2)
                
                pwd_last_set_str = safe_get("pwdLastSet")
                must_change_pwd = (pwd_last_set_str == "0")
                
                ext_attrs = {}
                for i in range(1, 16):
                    ext_val = safe_get(f"extensionAttribute{i}")
                    if ext_val:
                        ext_attrs[f"extensionAttribute{i}"] = ext_val
                
                pager_val = safe_get("pager")
                emp_id_val = safe_get("employeeID")
                print_code = pager_val if pager_val else emp_id_val
                
                # Extract CN for name fallback
                dn_cn = raw_name if cn_part.upper().startswith("CN=") else ""
                
                return {
                    "uid": safe_get("sAMAccountName"),
                    "name": safe_get("displayName") or safe_get("cn") or dn_cn or raw_name or dn,
                    "email": safe_get("mail"),
                    "title": safe_get("title"),
                    "dept": safe_get("department"),
                    "printCode": print_code,
                    "ou": ",".join(dn_parts[1:]) if len(dn_parts) > 1 else "",
                    "papercut": "Synced",
                    "status": status,
                    "mobile": safe_get("mobile"),
                    "company": safe_get("company"),
                    "manager": manager_val,
                    "office": safe_get("physicalDeliveryOfficeName"),
                    "description": safe_get("description"),
                    "street": safe_get("streetAddress"),
                    "city": safe_get("l"),
                    "state": safe_get("st"),
                    "zipCode": safe_get("postalCode"),
                    "country": safe_get("co"),
                    "givenName": safe_get("givenName"),
                    "initials": safe_get("initials"),
                    "sn": safe_get("sn"),
                    "displayName": safe_get("displayName"),
                    "telephoneNumber": safe_get("telephoneNumber"),
                    "otherTelephone": safe_get("otherTelephone"),
                    "wWWHomePage": safe_get("wWWHomePage"),
                    "postOfficeBox": safe_get("postOfficeBox"),
                    "userPrincipalName": safe_get("userPrincipalName"),
                    "sAMAccountName": safe_get("sAMAccountName"),
                    "userAccountControl": uac,
                    "pwdNeverExpires": pwd_never_expires,
                    "acctDisabled": acct_disabled,
                    "mustChangePwd": must_change_pwd,
                    "accountExpires": safe_get("accountExpires"),
                    "pwdLastSet": pwd_last_set_str,
                    "logonHours": safe_get("logonHours"),
                    "profilePath": safe_get("profilePath"),
                    "scriptPath": safe_get("scriptPath"),
                    "homeDirectory": safe_get("homeDirectory"),
                    "homeDrive": safe_get("homeDrive"),
                    "homePhone": safe_get("homePhone"),
                    "pager": safe_get("pager"),
                    "facsimileTelephoneNumber": safe_get("facsimileTelephoneNumber"),
                    "ipPhone": safe_get("ipPhone"),
                    "comment": safe_get("info"),
                    "memberOf": member_of_list,
                    "employeeID": safe_get("employeeID"),
                    "employeeType": safe_get("employeeType"),
                    "mailNickname": safe_get("mailNickname"),
                    "extensionAttributes": ext_attrs
                }
            except Exception as search_err:
                logger.exception(f"LDAP search failed in get_user_details for DN {dn}")
                raise search_err
            finally:
                if conn:
                    conn.unbind()
            _details_cache.set(dn, result_dict)
            return result_dict
        except Exception as outer_err:
            logger.exception(f"Outer exception in get_user_details for DN {dn}")
            raise outer_err

    def get_group_details(self, dn: str) -> Optional[dict]:
        """
        Gets detailed attributes of a Group in Active Directory.
        """
        cached_data = _details_cache.get(dn)
        if cached_data:
            return cached_data

        import re
        try:
            dn_parts = re.split(r'(?<!\\),', dn)
            cn_part = dn_parts[0] if dn_parts else ''
            raw_name = cn_part[3:].replace('\\\\,', ',').replace('\\,', ',').strip() if cn_part.upper().startswith('CN=') else cn_part.replace('\\\\,', ',').replace('\\,', ',').strip()

            if self.mock_mode:
                return {
                    "uid": raw_name,
                    "name": raw_name,
                    "sAMAccountName": raw_name,
                    "description": f"Mock group for {raw_name}",
                    "groupScope": "Global",
                    "groupCategory": "Security",
                    "cn": raw_name,
                    "members": [
                        {"dn": "CN=Anek Phromsiri,OU=Engineering,OU=Users,DC=aapico,DC=com", "name": "Anek Phromsiri", "type": "user"},
                        {"dn": "CN=Vipha Jinda,OU=Users,DC=aapico,DC=com", "name": "Vipha Jinda", "type": "user"}
                    ],
                    "memberOf": [
                        {"dn": "CN=Administrators,CN=Builtin,DC=aapico,DC=com", "name": "Administrators", "type": "group"}
                    ],
                    "extensionAttributes": {}
                }

            conn = self._get_connection()
            try:
                conn.search(
                    search_base=dn,
                    search_filter="(objectClass=group)",
                    search_scope=BASE,
                    attributes=["sAMAccountName", "description", "groupType", "member", "memberOf", "cn"]
                )
                if not conn.entries:
                    return None
                    
                entry = conn.entries[0]
                
                def safe_get(attr_name, default=""):
                    try:
                        if hasattr(entry, attr_name):
                            attr = getattr(entry, attr_name)
                            if attr and attr.value:
                                if isinstance(attr.value, list):
                                    return str(attr.value[0]) if attr.value else default
                                return str(attr.value)
                    except Exception:
                        pass
                    return default

                group_type_val = safe_get("groupType")
                scope = "Global"
                category = "Security"
                if group_type_val:
                    try:
                        val = int(group_type_val) & 0xFFFFFFFF
                        # 0x80000000 (2147483648) means Security Group
                        category = "Security" if (val & 2147483648) else "Distribution"
                        # Scope
                        if (val & 4):
                            scope = "Domain Local"
                        elif (val & 8):
                            scope = "Universal"
                        elif (val & 2):
                            scope = "Global"
                    except:
                        pass

                # Parse members
                members_list = []
                try:
                    if hasattr(entry, 'member') and entry.member.value:
                        vals = entry.member.value if isinstance(entry.member.value, list) else [entry.member.value]
                        for m_dn in vals:
                            m_parts = re.split(r'(?<!\\),', str(m_dn))
                            m_cn_parts = [p for p in m_parts if p.upper().startswith("CN=")]
                            m_name = m_cn_parts[0].split("=", 1)[1].replace('\\\\,', ',').replace('\\,', ',').strip() if m_cn_parts else str(m_dn)
                            # infer type from DN (basic)
                            m_type = "user"
                            if "OU=Groups" in m_dn or "OU=Security Groups" in m_dn or "CN=Users" in m_dn and not ("OU=Users" in m_dn):
                                m_type = "group" # simplistic heuristic
                            elif "CN=Computers" in m_dn or "OU=Domain Controllers" in m_dn:
                                m_type = "computer"
                            members_list.append({"dn": str(m_dn), "name": m_name, "type": m_type})
                except Exception as e:
                    logger.warning(f"Failed to parse member for group {dn}: {e}")

                # Parse memberOf
                member_of_list = []
                try:
                    if hasattr(entry, 'memberOf') and entry.memberOf.value:
                        vals = entry.memberOf.value if isinstance(entry.memberOf.value, list) else [entry.memberOf.value]
                        for m_dn in vals:
                            m_parts = re.split(r'(?<!\\),', str(m_dn))
                            m_cn_parts = [p for p in m_parts if p.upper().startswith("CN=")]
                            m_name = m_cn_parts[0].split("=", 1)[1].replace('\\\\,', ',').replace('\\,', ',').strip() if m_cn_parts else str(m_dn)
                            member_of_list.append({"dn": str(m_dn), "name": m_name, "type": "group"})
                except Exception as e:
                    logger.warning(f"Failed to parse memberOf for group {dn}: {e}")

                result_dict = {
                    "uid": safe_get("sAMAccountName"),
                    "name": safe_get("cn") or raw_name,
                    "sAMAccountName": safe_get("sAMAccountName"),
                    "description": safe_get("description"),
                    "groupScope": scope,
                    "groupCategory": category,
                    "cn": safe_get("cn"),
                    "members": members_list,
                    "memberOf": member_of_list,
                    "extensionAttributes": {}
                }
                _details_cache.set(dn, result_dict)
                return result_dict
            finally:
                if conn:
                    conn.unbind()
        except Exception as outer_err:
            logger.exception(f"Outer exception in get_group_details for DN {dn}")
            raise outer_err

    def search_ous(self, query: str = "") -> list:
        """
        Searches/lists Organizational Units (OUs) in Active Directory.
        """
        if self.mock_mode:
            mock_ous = [
                "OU=newhire,OU=Users,DC=aapico,DC=com",
                "OU=contract,OU=Users,DC=aapico,DC=com",
                "OU=Engineering,OU=Users,DC=aapico,DC=com",
                "OU=Marketing,OU=Users,DC=aapico,DC=com",
                "OU=Human Resources,OU=Users,DC=aapico,DC=com",
                "OU=Information Technology,OU=Users,DC=aapico,DC=com"
            ]
            if query:
                q = query.lower()
                return [ou for ou in mock_ous if q in ou.lower()]
            return mock_ous

        conn = self._get_connection()
        try:
            search_filter = "(objectClass=organizationalUnit)"
            conn.search(
                search_base=self.base_dn,
                search_filter=search_filter,
                search_scope=SUBTREE,
                attributes=["distinguishedName"]
            )
            ous = [entry.entry_dn for entry in conn.entries]
            if query:
                q = query.lower()
                ous = [ou for ou in ous if q in ou.lower()]
            return ous
        except Exception as e:
            raise ActiveDirectoryError(f"Error searching OUs in AD: {str(e)}")
        finally:
            if conn:
                conn.unbind()

    def search_groups(self, query: str = "") -> list:
        """
        Searches/lists Security Groups in Active Directory.
        """
        if self.mock_mode:
            mock_groups = [
                {"name": "Domain Admins", "scope": "Global", "desc": "Designated administrators of the domain"},
                {"name": "Enterprise Admins", "scope": "Universal", "desc": "Designated administrators of the enterprise"},
                {"name": "Engineering Users", "scope": "Global", "desc": "All core staff assigned to Engineering divisions"},
                {"name": "VPN Operators", "scope": "Local", "desc": "Members are permitted to establish corporate VPN tunnels"},
                {"name": "IT Support Tier 2", "scope": "Global", "desc": "Advanced operational level IT support team privileges"},
                {"name": "Marketing Managers", "scope": "Global", "desc": "Department heads for Marketing promotions group"},
                {"name": "HR Coordinators", "scope": "Global", "desc": "Human Resources database write access delegates"}
            ]
            if query:
                q = query.lower()
                return [g for g in mock_groups if q in g["name"].lower()]
            return mock_groups

        conn = self._get_connection()
        try:
            search_filter = "(objectClass=group)"
            if query:
                search_filter = f"(&(objectClass=group)(cn=*{query}*))"
                
            conn.search(
                search_base=self.base_dn,
                search_filter=search_filter,
                search_scope=SUBTREE,
                attributes=["cn", "groupType", "description", "distinguishedName"]
            )
            
            groups = []
            for entry in conn.entries:
                name = entry.cn.value if hasattr(entry, 'cn') and entry.cn.value else entry.entry_dn
                
                group_type_val = entry.groupType.value if hasattr(entry, 'groupType') else None
                scope = "Global"
                if group_type_val is not None:
                    val = int(group_type_val) & 0xFFFFFFFF
                    if val == 0x80000004 or val == 4:
                        scope = "Domain Local"
                    elif val == 0x80000008 or val == 8:
                        scope = "Universal"
                    elif val == 0x2:
                        scope = "Global (Distribution)"
                
                desc = entry.description.value if hasattr(entry, 'description') and entry.description.value else ""
                if isinstance(desc, list) and desc:
                    desc = desc[0]
                elif not isinstance(desc, str):
                    desc = str(desc) if desc else ""

                groups.append({
                    "name": name,
                    "scope": scope,
                    "desc": desc,
                    "dn": entry.entry_dn
                })
            return groups
        except Exception as e:
            raise ActiveDirectoryError(f"Error searching Groups in AD: {str(e)}")
        finally:
            if conn:
                conn.unbind()

    def bulk_check_groups(self, group_names: list) -> list:
        """
        Check multiple Security Groups in Active Directory (Exact Match).
        """
        # Deduplicate list while preserving order
        seen = set()
        unique_names = []
        for name in group_names:
            if name:
                clean_name = name.strip()
                if clean_name and clean_name.lower() not in seen:
                    seen.add(clean_name.lower())
                    unique_names.append(clean_name)

        if self.mock_mode:
            mock_groups = [
                {"name": "Domain Admins", "scope": "Global", "desc": "Designated administrators of the domain"},
                {"name": "Enterprise Admins", "scope": "Universal", "desc": "Designated administrators of the enterprise"},
                {"name": "Engineering Users", "scope": "Global", "desc": "All core staff assigned to Engineering divisions"},
                {"name": "VPN Operators", "scope": "Local", "desc": "Members are permitted to establish corporate VPN tunnels"},
                {"name": "IT Support Tier 2", "scope": "Global", "desc": "Advanced operational level IT support team privileges"},
                {"name": "Marketing Managers", "scope": "Global", "desc": "Department heads for Marketing promotions group"},
                {"name": "HR Coordinators", "scope": "Global", "desc": "Human Resources database write access delegates"},
                {"name": "AH IT", "scope": "Global", "desc": "AAPICO Hitech IT Group"},
                {"name": "CL100", "scope": "Global", "desc": "CL100 User access"},
                {"name": "AAPICO Group VPN", "scope": "Universal", "desc": "VPN Access for AAPICO Group"},
                {"name": "AH IT Infrastructure", "scope": "Global", "desc": "AH IT Infrastructure team"},
                {"name": "AAPICO Social App", "scope": "Global", "desc": "AAPICO Social App access group"},
                {"name": "AAPICO Allow USB", "scope": "Domain Local", "desc": "USB Permission group"},
                {"name": "User_LevelB (AH)", "scope": "Global", "desc": "User Level B access group"},
                {"name": "Administrators", "scope": "Domain Local", "desc": "Builtin Administrators group"},
                {"name": "Remote Desktop Users", "scope": "Domain Local", "desc": "Remote Desktop Access"},
            ]
            results = []
            for name in unique_names:
                match = next((g for g in mock_groups if g["name"].lower() == name.lower()), None)
                if match:
                    results.append({
                        "name": match["name"],
                        "status": "Found",
                        "scope": match["scope"],
                        "desc": match["desc"],
                        "dn": f"CN={match['name']},CN=Users,{self.base_dn}"
                    })
                else:
                    results.append({
                        "name": name,
                        "status": "Not Found",
                        "scope": "-",
                        "desc": "",
                        "dn": ""
                    })
            return results

        conn = self._get_connection()
        try:
            results = []
            for name in unique_names:
                # Escape special characters for LDAP filter
                escaped_name = name.replace('\\', '\\5c').replace('*', '\\2a').replace('(', '\\28').replace(')', '\\29').replace('\x00', '\\00')
                search_filter = f"(&(objectClass=group)(|(sAMAccountName={escaped_name})(cn={escaped_name})))"
                
                conn.search(
                    search_base=self.base_dn,
                    search_filter=search_filter,
                    search_scope=SUBTREE,
                    attributes=["cn", "groupType", "description", "distinguishedName"]
                )
                
                if conn.entries:
                    entry = conn.entries[0]
                    g_name = entry.cn.value if hasattr(entry, 'cn') and entry.cn.value else entry.entry_dn
                    
                    group_type_val = entry.groupType.value if hasattr(entry, 'groupType') else None
                    scope = "Global"
                    if group_type_val is not None:
                        val = int(group_type_val) & 0xFFFFFFFF
                        if val == 0x80000004 or val == 4:
                            scope = "Domain Local"
                        elif val == 0x80000008 or val == 8:
                            scope = "Universal"
                        elif val == 0x2:
                            scope = "Global (Distribution)"
                            
                    desc = entry.description.value if hasattr(entry, 'description') and entry.description.value else ""
                    if isinstance(desc, list) and desc:
                        desc = desc[0]
                    elif not isinstance(desc, str):
                        desc = str(desc) if desc else ""
                        
                    results.append({
                        "name": g_name,
                        "status": "Found",
                        "scope": scope,
                        "desc": desc,
                        "dn": entry.entry_dn
                    })
                else:
                    results.append({
                        "name": name,
                        "status": "Not Found",
                        "scope": "-",
                        "desc": "",
                        "dn": ""
                    })
            return results
        except Exception as e:
            raise ActiveDirectoryError(f"Error bulk searching Groups in AD: {str(e)}")
        finally:
            if conn:
                conn.unbind()

    def create_user(self, user_details: Dict[str, Any], is_contractor: bool = False, target_ou: str = None) -> Tuple[bool, str]:
        """
        Creates a new user account in Active Directory inside the designated OU.
        """
        sam_account_name = user_details.get("username")
        if not sam_account_name:
            raise ActiveDirectoryError("sAMAccountName (username) is required to create AD user.")
            
        # Select appropriate Organizational Unit (OU)
        if target_ou:
            resolved_ou = target_ou
        else:
            resolved_ou = self.contract_ou if is_contractor else self.new_hire_ou
            if not resolved_ou:
                resolved_ou = self.base_dn  # Fallback to base DN if OU not defined
            
        custom_attrs = user_details.get("custom_attributes") or {}
        
        # Display name check to form User DN
        display_name_val = custom_attrs.get("display_name") or user_details.get("name_english")
        user_dn = f"CN={display_name_val},{resolved_ou}"
        
        if self.mock_mode:
            logger.info(f"[Mock AD] Successfully created user {user_dn} in Active Directory.")
            return True, user_dn
            
        conn = self._get_connection()
        try:
            # Map parameters based on map_field.md requirements and custom_attributes overrides
            first_name, last_name = self.extract_first_last_name(user_details.get("name_english", ""))
            company = user_details.get("company", "")
            employee_id = user_details.get("employee_id", "")
            ext = user_details.get("ext", "")
            mobile_phone = user_details.get("mobile_phone", "")
            position = user_details.get("position", "")
            department = user_details.get("department", "")
            
            # Form default values
            default_display_name = f"{user_details.get('name_english', '')} ({company})" if company else user_details.get('name_english', '')
            default_telephone_number = f"035-350880 ext.{ext}" if ext else ""
            default_email = f"{sam_account_name}@{company.lower() if company else 'company'}.com"

            # Resolve manager/supervisor to distinguishedName
            supervisor_name = custom_attrs.get("manager") or user_details.get("supervisor_name")
            resolved_manager_dn = ""
            if supervisor_name:
                if supervisor_name.lower().startswith("cn=") and "dc=" in supervisor_name.lower():
                    resolved_manager_dn = supervisor_name
                else:
                    try:
                        escaped_mgr = supervisor_name.replace('\\', '\\5c').replace('*', '\\2a').replace('(', '\\28').replace(')', '\\29').replace('\x00', '\\00')
                        search_filter = f"(&(objectClass=user)(|(sAMAccountName={escaped_mgr})(displayName={escaped_mgr})(cn={escaped_mgr})(mail={escaped_mgr})(anr={escaped_mgr})))"
                        conn.search(
                            search_base=self.base_dn,
                            search_filter=search_filter,
                            search_scope=SUBTREE,
                            attributes=["distinguishedName"]
                        )
                        if conn.entries:
                            resolved_manager_dn = conn.entries[0].distinguishedName.value
                            logger.info(f"Resolved manager DN: {resolved_manager_dn} for '{supervisor_name}'")
                        else:
                            logger.warning(f"Could not resolve manager DN for '{supervisor_name}'. Omit manager attribute.")
                    except Exception as e:
                        logger.error(f"Error resolving manager DN: {e}")
            
            attributes = {
                "objectClass": ["top", "person", "organizationalPerson", "user"],
                "sAMAccountName": sam_account_name,
                "userPrincipalName": custom_attrs.get("user_principal_name") or f"{sam_account_name}@aapico.com",
                "displayName": custom_attrs.get("display_name") or default_display_name,
                "givenName": custom_attrs.get("first_name") or first_name,
                "sn": custom_attrs.get("last_name") or last_name,
                "description": custom_attrs.get("description") or employee_id,
                "physicalDeliveryOfficeName": custom_attrs.get("office") or company,
                "telephoneNumber": custom_attrs.get("telephone_number") or default_telephone_number,
                "mail": custom_attrs.get("email") or default_email,
                "l": custom_attrs.get("city") or "Ban Len, Bang pa-in",
                "st": custom_attrs.get("state_province") or "Phranakhon Sri Ayutthaya",
                "postalCode": custom_attrs.get("zip_postal_code") or "13160",
                "co": custom_attrs.get("country_region") or "Thailand",
                "mobile": custom_attrs.get("mobile") or mobile_phone,
                "title": custom_attrs.get("title") or position,
                "department": custom_attrs.get("department") or department,
                "company": custom_attrs.get("company") or company,
                "employeeID": custom_attrs.get("employee_id") or employee_id,
                "pwdLastSet": 0,  # User must change password at next logon initially
                "userAccountControl": "514" # 512 (Normal Account) + 2 (Account Disabled initially)
            }

            if resolved_manager_dn:
                attributes["manager"] = resolved_manager_dn

            # Map extra custom attributes (e.g. from ADUC validation script)
            extra_mappings = {
                "street": "streetAddress",
                "post_office_box": "postOfficeBox",
                "logon_script": "scriptPath",
                "notes": "comment",
                "home_phone": "homePhone",
                "pager": "pager",
                "fax": "facsimileTelephoneNumber",
                "ip_phone": "ipPhone",
                "web_page": "wWWHomePage",
                "employee_type": "employeeType",
                "mail_nickname": "mailNickname",
                "user_workstations": "userWorkstations",
                "profile_path": "profilePath",
                "home_directory": "homeDirectory",
                "home_drive": "homeDrive"
            }
            
            for k, attr_name in extra_mappings.items():
                val = custom_attrs.get(k)
                if val is not None and val != "":
                    attributes[attr_name] = val
                    
            for i in range(1, 16):
                ext_val = custom_attrs.get(f"extension_attribute_{i}")
                if ext_val:
                    attributes[f"extensionAttribute{i}"] = ext_val
            
            # Remove empty values, empty lists or None
            attributes = {k: v for k, v in attributes.items() if v is not None and v != "" and v != []}
            
            success = conn.add(user_dn, attributes=attributes)
            if not success:
                raise ActiveDirectoryError(f"LDAP creation failed: {conn.result.get('description', 'Unknown error')}")
                
            logger.info(f"Successfully created AD user: {user_dn}")

            # Handle password setting if provided (requires LDAPS)
            password = custom_attrs.get("password")
            if password:
                try:
                    encoded_password = f'"{password}"'.encode('utf-16-le')
                    if conn.modify(user_dn, {'unicodePwd': [(2, [encoded_password])]}):
                        logger.info("Successfully updated unicodePwd (password) for user")
                    else:
                        logger.warning(f"Failed to set password: {conn.result}")
                except Exception as pw_err:
                    logger.warning(f"Failed to set password: {pw_err}")

            # Set user must change password at next logon (pwdLastSet)
            change_pwd = custom_attrs.get("change_password_next_logon", True)
            try:
                pwd_val = '0' if change_pwd else '-1'
                if conn.modify(user_dn, {'pwdLastSet': [(2, [pwd_val])]}):
                    logger.info(f"Successfully set pwdLastSet to {pwd_val}")
                else:
                    logger.warning(f"Failed to set pwdLastSet to {pwd_val}: {conn.result}")
            except Exception as pwd_err:
                logger.warning(f"Failed to set pwdLastSet to {pwd_val}: {pwd_err}")

            # Update UserAccountControl (UAC) after creation and password setup
            uac = 512
            if custom_attrs.get('password_never_expires'):
                uac |= 0x10000  # DONT_EXPIRE_PASSWORD
            if custom_attrs.get('account_disabled', False):
                uac |= 0x0002   # ACCOUNTDISABLE
            else:
                # If account is enabled but password was not set, AD might reject enabling.
                # However, if password was set, we can safely enable.
                if not password:
                    uac |= 0x0002   # Default to disabled if no password set
            if custom_attrs.get('smartcard_required'):
                uac |= 0x00400000  # SMARTCARD_REQUIRED
                
            try:
                if conn.modify(user_dn, {'userAccountControl': [(2, [str(uac)])]}):
                    logger.info(f"Successfully updated userAccountControl to {uac}")
                else:
                    logger.warning(f"Failed to update userAccountControl: {conn.result}")
            except Exception as uac_err:
                logger.warning(f"Failed to update userAccountControl: {uac_err}")

            # Handle adding user to groups
            groups = custom_attrs.get("groups")
            if groups and isinstance(groups, list):
                for group in groups:
                    group_dn = ""
                    if "," in group:
                        group_dn = group
                    else:
                        try:
                            escaped_group = group.replace('\\', '\\5c').replace('*', '\\2a').replace('(', '\\28').replace(')', '\\29').replace('\x00', '\\00')
                            conn.search(
                                search_base=self.base_dn,
                                search_filter=f"(&(objectClass=group)(cn={escaped_group}))",
                                search_scope=SUBTREE,
                                attributes=['distinguishedName']
                            )
                            if conn.entries:
                                group_dn = conn.entries[0].distinguishedName.value
                        except Exception as e:
                            logger.error(f"Error searching group {group}: {e}")
                            
                    if group_dn:
                        try:
                            conn.modify(group_dn, {'member': [(0, [user_dn])]})
                            logger.info(f"Added user to group: {group_dn}")
                        except Exception as grp_err:
                            logger.warning(f"Failed to add user to group {group_dn}: {grp_err}")
            
            return True, user_dn
            
        except Exception as e:
            if isinstance(e, ActiveDirectoryError):
                raise e
            raise ActiveDirectoryError(f"Error provisioning user in AD: {str(e)}")
        finally:
            if conn:
                conn.unbind()

ad_service = ActiveDirectoryService()

