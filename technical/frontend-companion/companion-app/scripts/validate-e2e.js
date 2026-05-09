#!/usr/bin/env node

/**
 * Companion App E2E Test Setup Validator
 * 
 * This script validates that the Playwright and Stagehand testing framework
 * has been properly configured and is ready for test execution.
 * 
 * Usage: npm run validate-e2e
 * Or: node scripts/validate-e2e.js
 */

const fs = require('fs');
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkFileExists(filePath) {
  return fs.existsSync(filePath);
}

function getFileSize(filePath) {
  try {
    const stats = fs.statSync(filePath);
    return stats.size;
  } catch {
    return 0;
  }
}

function listTestFiles(dir) {
  try {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir).filter(f => f.endsWith('.spec.ts'));
  } catch {
    return [];
  }
}

async function main() {
  log('\n╔════════════════════════════════════════════════════════════╗', 'blue');
  log('║  Companion App - E2E Testing Framework Validation Report   ║', 'blue');
  log('╚════════════════════════════════════════════════════════════╝\n', 'blue');

  const baseDir = __dirname.replace(/\/scripts$/, '');
  const checks = [];

  // 1. Check Configuration Files
  log('📋 Configuration Files:', 'blue');
  const configFiles = [
    { path: 'playwright.config.ts', name: 'Playwright Config' },
    { path: 'E2E_TEST_FLOW.md', name: 'Testing Guide' },
    { path: 'PLAYWRIGHT_SETUP.md', name: 'Setup Guide' },
    { path: 'package.json', name: 'Package.json' },
  ];

  configFiles.forEach(file => {
    const fullPath = path.join(baseDir, file.path);
    const exists = checkFileExists(fullPath);
    const size = getFileSize(fullPath);
    const status = exists ? '✓' : '✗';
    const color = exists ? 'green' : 'red';
    log(`  ${status} ${file.name.padEnd(25)} (${size} bytes)`, color);
    checks.push({ name: file.name, passed: exists });
  });

  // 2. Check Test Directory Structure
  log('\n📁 Test Directory Structure:', 'blue');
  const dirs = [
    { path: 'e2e', name: 'E2E Root' },
    { path: 'e2e/tests', name: 'Test Files' },
    { path: 'e2e/fixtures', name: 'Fixtures' },
    { path: 'e2e/helpers', name: 'Helpers' },
  ];

  dirs.forEach(dir => {
    const fullPath = path.join(baseDir, dir.path);
    const exists = checkFileExists(fullPath);
    const status = exists ? '✓' : '✗';
    const color = exists ? 'green' : 'red';
    log(`  ${status} ${dir.name.padEnd(25)} (${fullPath})`, color);
    checks.push({ name: `Directory: ${dir.name}`, passed: exists });
  });

  // 3. Check Test Files
  log('\n🧪 Test Files:', 'blue');
  const testDir = path.join(baseDir, 'e2e/tests');
  const testFiles = listTestFiles(testDir);
  
  if (testFiles.length === 0) {
    log('  ✗ No test files found', 'red');
  } else {
    testFiles.forEach(file => {
      const fullPath = path.join(testDir, file);
      const size = getFileSize(fullPath);
      log(`  ✓ ${file.padEnd(35)} (${size} bytes)`, 'green');
    });
  }
  checks.push({ name: 'Test Files', passed: testFiles.length > 0 });

  // 4. Check Helper Files
  log('\n🔧 Helper & Fixture Files:', 'blue');
  const helperFiles = [
    { path: 'e2e/fixtures/page-objects.ts', name: 'Page Objects' },
    { path: 'e2e/fixtures/test-data.ts', name: 'Test Data' },
    { path: 'e2e/helpers/stagehand-utils.ts', name: 'Stagehand Utils' },
  ];

  helperFiles.forEach(file => {
    const fullPath = path.join(baseDir, file.path);
    const exists = checkFileExists(fullPath);
    const size = getFileSize(fullPath);
    const status = exists ? '✓' : '✗';
    const color = exists ? 'green' : 'red';
    log(`  ${status} ${file.name.padEnd(30)} (${size} bytes)`, color);
    checks.push({ name: file.name, passed: exists });
  });

  // 5. Check package.json Scripts
  log('\n📦 Test Scripts in package.json:', 'blue');
  try {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(baseDir, 'package.json'), 'utf8')
    );
    
    const requiredScripts = [
      'test:e2e',
      'test:e2e:ui',
      'test:e2e:debug',
      'test:e2e:headed',
    ];

    requiredScripts.forEach(script => {
      const exists = !!packageJson.scripts?.[script];
      const status = exists ? '✓' : '✗';
      const color = exists ? 'green' : 'red';
      const command = packageJson.scripts?.[script] || 'NOT FOUND';
      log(`  ${status} npm run ${script.padEnd(20)} (${command})`, color);
      checks.push({ name: `Script: ${script}`, passed: exists });
    });
  } catch (error) {
    log(`  ✗ Error reading package.json: ${error.message}`, 'red');
  }

  // 6. Check Dependencies
  log('\n📚 Dependencies Status:', 'blue');
  try {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(baseDir, 'package.json'), 'utf8')
    );
    
    const deps = packageJson.devDependencies || {};
    const hasPlaywright = !!deps['@playwright/test'];
    
    log(
      `  ${hasPlaywright ? '✓' : '○'} @playwright/test ${deps['@playwright/test'] || '(not installed)'}`,
      hasPlaywright ? 'green' : 'yellow'
    );
    
    checks.push({ name: '@playwright/test', passed: hasPlaywright });
  } catch (error) {
    log(`  Error: ${error.message}`, 'red');
  }

  // 7. Summary
  log('\n' + '═'.repeat(60), 'blue');
  const passed = checks.filter(c => c.passed).length;
  const total = checks.length;
  const percentage = Math.round((passed / total) * 100);

  log(`✓ Tests Setup Status: ${passed}/${total} checks passed (${percentage}%)`, 'blue');
  log('═'.repeat(60) + '\n', 'blue');

  if (percentage === 100) {
    log('✅ E2E Testing Framework is fully configured!', 'green');
    log('\n📖 Next Steps:', 'blue');
    log('  1. Install Playwright: npm install --save-dev @playwright/test', 'gray');
    log('  2. Install browsers: npx playwright install', 'gray');
    log('  3. Run tests: npm run test:e2e', 'gray');
    log('  4. View results: npx playwright show-report', 'gray');
  } else if (percentage >= 50) {
    log('⚠️  E2E Testing Framework is partially configured.', 'yellow');
    log('   Missing items:');
    checks
      .filter(c => !c.passed)
      .forEach(c => log(`   - ${c.name}`, 'yellow'));
  } else {
    log('❌ E2E Testing Framework needs configuration.', 'red');
    log('   Missing items:');
    checks
      .filter(c => !c.passed)
      .forEach(c => log(`   - ${c.name}`, 'red'));
  }

  log('\n📚 Documentation:', 'blue');
  log('  • E2E_TEST_FLOW.md - Comprehensive testing guide', 'gray');
  log('  • PLAYWRIGHT_SETUP.md - Installation and troubleshooting', 'gray');
  log('  • e2e/tests/milestone-0.spec.ts - Sample test file', 'gray');

  log('\n' + '═'.repeat(60) + '\n', 'blue');

  // Exit with appropriate code
  process.exit(percentage === 100 ? 0 : 1);
}

main().catch(error => {
  console.error('Validation error:', error);
  process.exit(1);
});
