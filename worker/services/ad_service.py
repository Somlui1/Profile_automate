import logging
from typing import Dict, Any, Tuple, List
from core.config import settings
from core.exceptions import ActiveDirectoryError

# Try importing ldap3
try:
    from ldap3 import Server, Connection, ServerPool, ALL, SUBTREE, LEVEL, MODIFY_REPLACE, ROUND_ROBIN
    LDAP_AVAILABLE = True
except ImportError:
    LDAP_AVAILABLE = False

logger = logging.getLogger("app.services.ad_service")

class ActiveDirectoryService:
    """
    Handles communication with Active Directory via LDAP/LDAPS.
    Supports multiple Domain Controllers with automatic failover.
    """
    def __init__(self):
        self.ad_hosts: List[str] = settings.WORKER_AD_HOSTS      # e.g. ["10.10.10.253", "10.10.10.250"]
        self.bind_dn: str = settings.WORKER_AD_USER               # e.g. "aapico\\msa.mcp"
        self.bind_password: str = settings.WORKER_AD_PASSWORD
        self.base_dn: str = settings.WORKER_AD_BASE_DN            # e.g. "DC=aapico,DC=com"
        
        self.new_hire_ou: str = settings.WORKER_AD_NEW_HIRE_OU
        self.contract_ou: str = settings.WORKER_AD_CONTRACT_OU
        
        # Determine mock mode: respects SYSTEM_MODE or checks credentials/library
        has_hosts = len(self.ad_hosts) > 0
        has_creds = bool(self.bind_dn and self.bind_password)
        if settings.SYSTEM_MODE == "mock":
            self.mock_mode = True
        else:
            self.mock_mode = not (has_hosts and has_creds) or not LDAP_AVAILABLE

        
        if self.mock_mode:
            reason = []
            if not LDAP_AVAILABLE:
                reason.append("ldap3 library not installed")
            if not has_hosts:
                reason.append("AD_HOSTS not configured")
            if not has_creds:
                reason.append("AD_USER or AD_PASSWORD missing")
            logger.warning(
                f"Active Directory LDAP is running in MOCK MODE. "
                f"Reason: {', '.join(reason)}. "
                f"Set AD_HOSTS, AD_USER, and AD_PASSWORD in .env to enable real LDAP sync."
            )
        else:
            logger.info(
                f"Active Directory configured with {len(self.ad_hosts)} host(s): "
                f"{', '.join(self.ad_hosts)} | Base DN: {self.base_dn}"
            )

    def _get_connection(self) -> Any:
        """
        Establishes and returns an LDAP Connection object.
        Tries each host in AD_HOSTS in order (failover).
        """
        if self.mock_mode:
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
                receive_timeout=3
            )
            logger.debug(f"LDAP connection established to: {conn.server.host}")
            return conn
        except Exception as e:
            hosts_str = ", ".join(self.ad_hosts)
            raise ActiveDirectoryError(
                f"Failed to connect to any LDAP Server ({hosts_str}): {str(e)}"
            )

    def check_user_exists(self, sam_account_name: str) -> bool:
        """
        Queries Active Directory to check if a user with the given sAMAccountName exists.
        """
        if self.mock_mode:
            # For testing, assume 'existing_user' exists, others don't
            return sam_account_name.lower() == "existing_user"
            
        conn = self._get_connection()
        try:
            search_filter = f"(sAMAccountName={sam_account_name})"
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

    def extract_first_last_name(self, name_english: str) -> Tuple[str, str]:
        """Extracts first and last name from English name."""
        clean_name = name_english.replace("Mr. ", "").replace("Ms. ", "").replace("Mrs. ", "").strip()
        parts = clean_name.split()
        first_name = parts[0] if parts else ""
        last_name = " ".join(parts[1:]) if len(parts) > 1 else ""
        return first_name, last_name



    def create_user(self, user_details: Dict[str, Any], is_contractor: bool = False, target_ou: str = None) -> Tuple[bool, str]:
        """
        Creates a new user account in Active Directory inside the designated OU.
        """
        sam_account_name = user_details.get("username")
        if not sam_account_name:
            raise ActiveDirectoryError("sAMAccountName (username) is required to create AD user.")

        # Check and resolve sAMAccountName length limit (20 chars) and collisions
        original_username = sam_account_name
        if len(sam_account_name) > 20:
            if "." in sam_account_name:
                parts = sam_account_name.split(".", 1)
                sam_account_name = f"{parts[0]}.{parts[1]}"[:20]
            else:
                sam_account_name = sam_account_name[:20]
            logger.info(f"Username '{original_username}' truncated to '{sam_account_name}' due to 20-character AD limit")

        # Collision resolution
        counter = 1
        base_username = sam_account_name
        while self.check_user_exists(sam_account_name):
            suffix = str(counter)
            available_len = 20 - len(suffix)
            sam_account_name = f"{base_username[:available_len]}{suffix}"
            counter += 1
            
        if sam_account_name != original_username:
            logger.info(f"Username resolved to '{sam_account_name}' due to conflict or length constraint")
            
        # Select appropriate Organizational Unit (OU)
        if target_ou:
            resolved_ou = target_ou
        else:
            resolved_ou = self.contract_ou if is_contractor else self.new_hire_ou
            if not resolved_ou:
                resolved_ou = self.base_dn  # Fallback to base DN if OU not defined

        # Pre-flight check: Target OU existence check
        if not self.mock_mode:
            conn = self._get_connection()
            try:
                from ldap3 import BASE
                conn.search(
                    search_base=resolved_ou,
                    search_filter="(objectClass=*)",
                    search_scope=BASE,
                    attributes=["distinguishedName"]
                )
                if not conn.entries:
                    raise ActiveDirectoryError(f"Target OU '{resolved_ou}' does not exist in Active Directory.")
            except Exception as ou_err:
                logger.error(f"OU validation failed for '{resolved_ou}': {ou_err}")
                raise ActiveDirectoryError(f"Target OU '{resolved_ou}' validation failed or does not exist: {ou_err}")
            finally:
                if conn:
                    conn.unbind()
            
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
                                search_filter=f"(&(objectClass=group)(|(sAMAccountName={escaped_group})(cn={escaped_group})))",
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

    def validate_user(self, sam_account_name: str, expected_properties: dict) -> Tuple[bool, list, list]:
        """
        Validates the AD user properties against the expected ones.
        Returns a tuple of (bool, List[str], List[str]) where the second list contains passed keys
        and the third contains details of any mismatch.
        """
        import ssl
        from ldap3 import Tls
        
        if self.mock_mode:
            logger.info(f"[Mock AD] Validating user '{sam_account_name}' - automatically PASS in mock mode.")
            return True, list(expected_properties.keys()), []

        conn = self._get_connection()
        try:
            ldap_mappings = {
                'first_name': 'givenName',
                'initials': 'initials',
                'last_name': 'sn',
                'display_name': 'displayName',
                'description': 'description',
                'office': 'physicalDeliveryOfficeName',
                'telephone_number': 'telephoneNumber',
                'other_telephone': 'otherTelephone',
                'email': 'mail',
                'web_page': 'wWWHomePage',
                'street': 'streetAddress',
                'post_office_box': 'postOfficeBox',
                'city': 'l',
                'state_province': 'st',
                'zip_postal_code': 'postalCode',
                'country_region': 'co',
                'user_workstations': 'userWorkstations',
                'profile_path': 'profilePath',
                'logon_script': 'scriptPath',
                'home_directory': 'homeDirectory',
                'home_drive': 'homeDrive',
                'home_phone': 'homePhone',
                'pager': 'pager',
                'mobile': 'mobile',
                'fax': 'facsimileTelephoneNumber',
                'ip_phone': 'ipPhone',
                'notes': 'comment',
                'title': 'title',
                'department': 'department',
                'company': 'company',
                'manager': 'manager',
                'employee_id': 'employeeID',
                'employee_type': 'employeeType',
                'mail_nickname': 'mailNickname',
            }
            
            for i in range(1, 16):
                ldap_mappings[f'extension_attribute_{i}'] = f'extensionAttribute{i}'
                
            ad_properties = list(ldap_mappings.values()) + ['userAccountControl', 'pwdLastSet', 'memberOf']
            
            conn.search(
                search_base=self.base_dn,
                search_filter=f"(sAMAccountName={sam_account_name})",
                search_scope=SUBTREE,
                attributes=ad_properties
            )
            
            if not conn.entries:
                return False, [], [f"User '{sam_account_name}' not found in AD."]
                
            user = conn.entries[0]
            passes = []
            failures = []
            
            for prop_key, expected_val in expected_properties.items():
                if prop_key == 'groups':
                    actual_groups = [g.split(',')[0].replace('CN=', '').lower().strip() for g in user.memberOf.values] if user.memberOf.values else []
                    if "domain users" not in actual_groups:
                        actual_groups.append("domain users")
                    expected_groups = [g.lower().strip() for g in expected_val]
                    missing_groups = [g for g in expected_groups if g not in actual_groups]
                    if missing_groups:
                        failures.append(f"Groups mismatch: Expected member of {expected_val}, but missing {missing_groups} in AD (AD groups: {actual_groups})")
                    else:
                        passes.append(prop_key)
                        
                elif prop_key == 'password_never_expires':
                    uac = int(user.userAccountControl.value or 0)
                    actual_val = bool(uac & 0x10000)
                    if actual_val != expected_val:
                        failures.append(f"password_never_expires: Expected {expected_val}, but got {actual_val}")
                    else:
                        passes.append(prop_key)
                        
                elif prop_key == 'account_disabled':
                    uac = int(user.userAccountControl.value or 0)
                    actual_val = bool(uac & 0x0002)
                    if actual_val != expected_val:
                        failures.append(f"account_disabled: Expected {expected_val}, but got {actual_val}")
                    else:
                        passes.append(prop_key)
                        
                elif prop_key == 'change_password_next_logon':
                    uac = int(user.userAccountControl.value or 0)
                    pwd_val = user.pwdLastSet.value
                    is_pwd_not_set = (pwd_val is None or pwd_val == 0 or (hasattr(pwd_val, 'year') and pwd_val.year == 1601))
                    actual_val = is_pwd_not_set and not (uac & 0x0002)
                    if actual_val != expected_val:
                        failures.append(f"change_password_next_logon: Expected {expected_val}, but got {actual_val}")
                    else:
                        passes.append(prop_key)
                        
                elif prop_key in ldap_mappings:
                    ldap_attr = ldap_mappings[prop_key]
                    actual_val = getattr(user, ldap_attr).value
                    
                    if isinstance(actual_val, list):
                        actual_cmp = sorted([str(x).strip().lower() for x in actual_val])
                        expected_cmp = sorted([str(x).strip().lower() for x in expected_val]) if isinstance(expected_val, list) else [str(expected_val).strip().lower()]
                    else:
                        actual_cmp = str(actual_val or "").strip().lower()
                        expected_cmp = str(expected_val or "").strip().lower()
                        
                    if prop_key == 'manager' and actual_val:
                        if expected_cmp not in actual_cmp:
                            failures.append(f"manager: Expected manager name '{expected_val}' to be in DN '{actual_val}'")
                        else:
                            passes.append(prop_key)
                        continue
                        
                    if expected_val is None or expected_val == "" or expected_val == []:
                        if actual_val:
                            failures.append(f"{prop_key} ({ldap_attr}): Expected empty, but got '{actual_val}'")
                        else:
                            passes.append(prop_key)
                    else:
                        if actual_cmp != expected_cmp:
                            failures.append(f"{prop_key} ({ldap_attr}): Expected '{expected_val}', but got '{actual_val}'")
                        else:
                            passes.append(prop_key)
            
            return len(failures) == 0, passes, failures
            
        except Exception as e:
            logger.error(f"Error validating user '{sam_account_name}' in AD: {e}")
            return False, [], [f"Error querying AD: {e}"]
        finally:
            if conn:
                conn.unbind()

ad_service = ActiveDirectoryService()
