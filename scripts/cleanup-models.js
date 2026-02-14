#!/usr/bin/env node
/**
 * Model Cleanup Script for lols-router
 * 
 * Removes downloaded model files from cache that are not referenced in models.json
 * Helps free disk space by cleaning up old or unused models
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Load configuration
function loadConfig() {
  const configPath = path.join(__dirname, '../config.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  return config;
}

// Load models.json
function loadModels() {
  const modelsPath = path.join(__dirname, '../models.json');
  const models = JSON.parse(fs.readFileSync(modelsPath, 'utf8'));
  return models;
}

// Expand tilde in paths
function expandTilde(filepath) {
  if (filepath && filepath.startsWith('~/')) {
    return filepath.replace('~', process.env.HOME || process.env.USERPROFILE);
  }
  return filepath;
}

// Get cache directory
function getCacheDir() {
  const config = loadConfig();
  const cachePath = config.llama?.cache || process.env.LLAMA_CACHE || '~/.cache/llama.cpp';
  return expandTilde(cachePath);
}

// Get whisper models directory
function getWhisperModelsDir() {
  const config = loadConfig();
  const modelsPath = config.whisper?.models || process.env.WHISPER_MODELS || '~/whisper.cpp/models';
  return expandTilde(modelsPath);
}

// Extract referenced model files from models.json
function getReferencedModels(modelsConfig) {
  const referenced = new Set();
  
  for (const [modelName, modelConfig] of Object.entries(modelsConfig.models)) {
    if (modelConfig.type === 'llama-cpp') {
      // Add main model file
      if (modelConfig.repo && modelConfig.file) {
        const repoSlug = modelConfig.repo.replace(/\//g, '_');
        const fileSlug = modelConfig.file.replace(/\//g, '_');
        referenced.add(`${repoSlug}_${fileSlug}`);
        
        console.log(`✓ Referenced: ${modelName} → ${repoSlug}_${fileSlug}`);
      }
      
      // Add mmproj file for vision models
      if (modelConfig.mmproj) {
        const repoSlug = modelConfig.repo.replace(/\//g, '_');
        const mmprojSlug = modelConfig.mmproj.replace(/\//g, '_');
        referenced.add(`${repoSlug}_${mmprojSlug}`);
        
        console.log(`✓ Referenced: ${modelName} (mmproj) → ${repoSlug}_${mmprojSlug}`);
      }
    } else if (modelConfig.type === 'whisper-cpp') {
      // Add whisper model file
      if (modelConfig.file) {
        referenced.add(modelConfig.file);
        console.log(`✓ Referenced: ${modelName} (whisper) → ${modelConfig.file}`);
      }
    }
  }
  
  return referenced;
}

// List files in cache directory
function listCacheFiles(cacheDir) {
  if (!fs.existsSync(cacheDir)) {
    console.log(`⚠️  Cache directory not found: ${cacheDir}`);
    return [];
  }
  
  const files = fs.readdirSync(cacheDir);
  return files.filter(file => {
    const filePath = path.join(cacheDir, file);
    const stats = fs.statSync(filePath);
    return stats.isFile() && (file.endsWith('.gguf') || file.endsWith('.bin'));
  });
}

// Get file size in human-readable format
function getFileSize(filePath) {
  const stats = fs.statSync(filePath);
  const bytes = stats.size;
  
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Main cleanup function
function cleanupModels(dryRun = true) {
  console.log('🧹 Model Cleanup Script\n');
  
  // Load configuration
  const modelsConfig = loadModels();
  const cacheDir = getCacheDir();
  const whisperDir = getWhisperModelsDir();
  
  console.log(`📁 LLM Cache: ${cacheDir}`);
  console.log(`📁 Whisper Models: ${whisperDir}\n`);
  
  // Get referenced models
  console.log('📋 Scanning referenced models...\n');
  const referenced = getReferencedModels(modelsConfig);
  console.log(`\n✅ Found ${referenced.size} referenced model files\n`);
  
  // Scan LLM cache
  console.log('🔍 Scanning LLM cache directory...\n');
  const cacheFiles = listCacheFiles(cacheDir);
  
  const unreferencedFiles = [];
  let totalSize = 0;
  
  for (const file of cacheFiles) {
    if (!referenced.has(file)) {
      const filePath = path.join(cacheDir, file);
      const size = getFileSize(filePath);
      const sizeBytes = fs.statSync(filePath).size;
      
      unreferencedFiles.push({ path: filePath, name: file, size, sizeBytes });
      totalSize += sizeBytes;
      
      console.log(`❌ Unreferenced: ${file} (${size})`);
    }
  }
  
  // Scan whisper models (if directory exists)
  if (fs.existsSync(whisperDir)) {
    console.log('\n🔍 Scanning Whisper models directory...\n');
    const whisperFiles = listCacheFiles(whisperDir);
    
    for (const file of whisperFiles) {
      if (!referenced.has(file)) {
        const filePath = path.join(whisperDir, file);
        const size = getFileSize(filePath);
        const sizeBytes = fs.statSync(filePath).size;
        
        unreferencedFiles.push({ path: filePath, name: file, size, sizeBytes });
        totalSize += sizeBytes;
        
        console.log(`❌ Unreferenced: ${file} (${size})`);
      }
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log(`\n📊 Summary:`);
  console.log(`   • Referenced models: ${referenced.size}`);
  console.log(`   • Unreferenced files: ${unreferencedFiles.length}`);
  console.log(`   • Reclaimable space: ${getFileSize({ size: totalSize })}`);
  console.log('');
  
  if (unreferencedFiles.length === 0) {
    console.log('✨ No unreferenced models found. Cache is clean!\n');
    return;
  }
  
  if (dryRun) {
    console.log('🔵 DRY RUN MODE - No files will be deleted');
    console.log('   Run with --delete flag to actually remove files\n');
    return;
  }
  
  // Confirm deletion
  console.log('⚠️  WARNING: This will permanently delete the above files!\n');
  
  // Delete files
  console.log('🗑️  Deleting unreferenced models...\n');
  
  for (const file of unreferencedFiles) {
    try {
      fs.unlinkSync(file.path);
      console.log(`✅ Deleted: ${file.name}`);
    } catch (err) {
      console.error(`❌ Failed to delete ${file.name}:`, err.message);
    }
  }
  
  console.log(`\n✅ Cleanup complete! Freed ${getFileSize({ size: totalSize })}\n`);
}

// Parse command line arguments
function main() {
  const args = process.argv.slice(2);
  const deleteFlag = args.includes('--delete') || args.includes('-d');
  const helpFlag = args.includes('--help') || args.includes('-h');
  
  if (helpFlag) {
    console.log(`
🧹 Model Cleanup Script

Usage: node scripts/cleanup-models.js [options]

Options:
  --delete, -d    Actually delete unreferenced models (default: dry run)
  --help, -h      Show this help message

Examples:
  node scripts/cleanup-models.js           # Dry run (show what would be deleted)
  node scripts/cleanup-models.js --delete  # Actually delete unreferenced models
  npm run cleanup-models                   # Dry run via npm
  npm run cleanup-models:delete            # Delete via npm

Note: This script only removes model files not referenced in models.json.
      All models listed in models.json will be preserved.
    `);
    return;
  }
  
  try {
    cleanupModels(!deleteFlag);
  } catch (err) {
    console.error('\n❌ Error:', err.message);
    process.exit(1);
  }
}

main();
