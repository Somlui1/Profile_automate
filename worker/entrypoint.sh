#!/bin/bash
set -e

AUTH_METHOD=${WORKER_AD_AUTH_METHOD:-$AD_AUTH_METHOD}
KEYTAB=${WORKER_KRB5_KEYTAB:-$KRB5_KEYTAB}
PRINCIPAL=${WORKER_KRB5_PRINCIPAL:-$KRB5_PRINCIPAL}

if [ "$AUTH_METHOD" = "kerberos" ]; then
    echo "Kerberos auth enabled for worker. Attempting kinit..."
    if [ -n "$KEYTAB" ] && [ -n "$PRINCIPAL" ]; then
        kinit -kt "$KEYTAB" "$PRINCIPAL"
        echo "Kerberos tickets:"
        klist
    else
        echo "Warning: KRB5_KEYTAB or KRB5_PRINCIPAL is not set!"
    fi
fi

exec "$@"
