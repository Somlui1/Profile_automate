#!/bin/bash
set -e

if [ "$AD_AUTH_METHOD" = "kerberos" ]; then
    echo "Kerberos auth enabled. Attempting kinit..."
    if [ -n "$KRB5_KEYTAB" ] && [ -n "$KRB5_PRINCIPAL" ]; then
        kinit -kt "$KRB5_KEYTAB" "$KRB5_PRINCIPAL"
        echo "Kerberos tickets:"
        klist
    else
        echo "Warning: KRB5_KEYTAB or KRB5_PRINCIPAL is not set!"
    fi
fi

exec "$@"
