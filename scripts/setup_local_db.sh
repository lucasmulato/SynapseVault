#!/bin/bash

# SynapseVault Local Setup Script
# This script initializes the PostgreSQL database and tables.

DB_NAME="synapsevault"
DB_USER="postgres"
DB_PASS="postgres"
DB_HOST="localhost"
DB_PORT="5432"

echo "Creating database $DB_NAME..."
# Note: Assumes psql is available and configured for the current user
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -c "CREATE DATABASE $DB_NAME;" 2>/dev/null

echo "Applying schema..."
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f /home/lucasmulato369/SynapseVault/scripts/schema.sql

echo "SynapseVault Database Initialized."
