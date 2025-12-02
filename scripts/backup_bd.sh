BIN=/usr/lib/postgresql/17/bin
URI="postgresql://postgres:PASS@srv07.ingenierosweb.co:5432"
F="samur_dea_$(date +'%Y%m%d_%H%M').dump"

# Reset BD
psql "$URI/postgres" -v ON_ERROR_STOP=1 -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='samur_dea_backup';"
psql "$URI/postgres" -c "DROP DATABASE IF EXISTS samur_dea_backup;"
psql "$URI/postgres" -c "CREATE DATABASE samur_dea_backup;"

# Dump (verbose + tiempo)
/usr/bin/time -v "$BIN/pg_dump" -F c -Z 9 --verbose "$URI/samur_dea" -f "$F"

# # Restore con barra de progreso (si tienes pv)
# pv "$F" | "$BIN/pg_restore" -j 4 --verbose -d "$URI/samur_dea_backup"
# restore paralelo (4 hilos) desde el archivo .dump
"$BIN/pg_restore" -j 4 --verbose -d "$URI/samur_dea_backup" "$F"
