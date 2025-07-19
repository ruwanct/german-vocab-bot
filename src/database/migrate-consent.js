#!/usr/bin/env node

const BetterSQLite = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const config = require('../../config/config');

/**
 * Migration script to add consent fields to the users table
 */

class ConsentMigration {
  constructor() {
    this.dbPath = path.resolve(config.database.path);
  }

  async migrate() {
    try {
      // Ensure directory exists
      const dbDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      const db = new BetterSQLite(this.dbPath);
      console.log('Connected to database for consent migration');

      // Add consent fields to users table (if they don't exist)
      try {
        db.exec(`ALTER TABLE users ADD COLUMN data_consent_given BOOLEAN DEFAULT 0`);
        console.log('✅ Added data_consent_given column');
      } catch (err) {
        if (err.message.includes('duplicate column name')) {
          console.log('✅ data_consent_given column already exists');
        } else {
          throw err;
        }
      }

      try {
        db.exec(`ALTER TABLE users ADD COLUMN data_consent_date DATETIME`);
        console.log('✅ Added data_consent_date column');
      } catch (err) {
        if (err.message.includes('duplicate column name')) {
          console.log('✅ data_consent_date column already exists');
        } else {
          throw err;
        }
      }

      try {
        db.exec(`ALTER TABLE users ADD COLUMN data_consent_version TEXT DEFAULT '1.0'`);
        console.log('✅ Added data_consent_version column');
      } catch (err) {
        if (err.message.includes('duplicate column name')) {
          console.log('✅ data_consent_version column already exists');
        } else {
          throw err;
        }
      }

      try {
        db.exec(`ALTER TABLE users ADD COLUMN privacy_policy_accepted BOOLEAN DEFAULT 0`);
        console.log('✅ Added privacy_policy_accepted column');
      } catch (err) {
        if (err.message.includes('duplicate column name')) {
          console.log('✅ privacy_policy_accepted column already exists');
        } else {
          throw err;
        }
      }

      db.close();
      console.log('🎉 Consent migration completed successfully');
    } catch (error) {
      console.error('Migration failed:', error);
      throw error;
    }
  }
}

// Command line interface
async function main() {
  const migration = new ConsentMigration();
  
  try {
    await migration.migrate();
    console.log('✅ Migration completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = ConsentMigration;