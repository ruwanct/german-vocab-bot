#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const config = require('../../config/config');

/**
 * Migration script to add consent fields to the users table
 */

class ConsentMigration {
  constructor() {
    this.dbPath = path.resolve(config.database.path);
  }

  async migrate() {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('Error opening database:', err);
          reject(err);
          return;
        }
        console.log('Connected to database for consent migration');
      });

      db.serialize(() => {
        // Add consent fields to users table
        db.run(`
          ALTER TABLE users ADD COLUMN data_consent_given BOOLEAN DEFAULT 0
        `, (err) => {
          if (err && !err.message.includes('duplicate column name')) {
            console.error('Error adding data_consent_given column:', err);
          } else {
            console.log('✅ Added data_consent_given column');
          }
        });

        db.run(`
          ALTER TABLE users ADD COLUMN data_consent_date DATETIME
        `, (err) => {
          if (err && !err.message.includes('duplicate column name')) {
            console.error('Error adding data_consent_date column:', err);
          } else {
            console.log('✅ Added data_consent_date column');
          }
        });

        db.run(`
          ALTER TABLE users ADD COLUMN data_consent_version TEXT DEFAULT '1.0'
        `, (err) => {
          if (err && !err.message.includes('duplicate column name')) {
            console.error('Error adding data_consent_version column:', err);
          } else {
            console.log('✅ Added data_consent_version column');
          }
        });

        db.run(`
          ALTER TABLE users ADD COLUMN privacy_policy_accepted BOOLEAN DEFAULT 0
        `, (err) => {
          if (err && !err.message.includes('duplicate column name')) {
            console.error('Error adding privacy_policy_accepted column:', err);
          } else {
            console.log('✅ Added privacy_policy_accepted column');
          }
        });
      });

      db.close((err) => {
        if (err) {
          console.error('Error closing database:', err);
          reject(err);
        } else {
          console.log('🎉 Consent migration completed successfully');
          resolve();
        }
      });
    });
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