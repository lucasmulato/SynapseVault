#!/bin/bash

# SynapseVault Local Setup Script
# This script initializes the PostgreSQL database and tables.

set -euo pipefail

DB_NAME="synapsevault"
DB_USER="postgres"
DB_PASS="postgres"
DB_HOST="localhost"
DB_PORT="5432"

# Resolve the schema path relative to this script so it works from any CWD.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCHEMA_SQL="${SCRIPT_DIR}/schema.sql"

echo "Creating database $DB_NAME..."
# Note: Assumes psql is available and configured for the current user
PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -c "CREATE DATABASE $DB_NAME;" 2>/dev/null || true

echo "Applying schema..."
PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$SCHEMA_SQL"

echo "SynapseVault Database Initialized."