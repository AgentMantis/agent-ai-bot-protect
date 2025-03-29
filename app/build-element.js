const fs = require('fs-extra');
const path = require('path');
const rollup = require('rollup');

(async function build() {
  const distPath = path.join(__dirname, 'dist/agent-ai-bot-protect/browser');
  const wpPluginPath = path.join('D:', 'source', 'repos', 'BotShield', 'plugins', 'agent-ai-bot-protect', 'dist');
  
  try {
    // Read the directory contents
    const files = await fs.readdir(distPath);
    console.log('Files in browser directory:', files);
    
    // Find the files
    const polyfillsFile = files.find(f => f.startsWith('polyfills-') && f.endsWith('.js'));
    const mainFile = files.find(f => f.startsWith('main-') && f.endsWith('.js'));
    const styleFile = files.find(f => f.startsWith('styles') && f.endsWith('.css'));
    
    if (!polyfillsFile || !mainFile) {
      throw new Error(`Could not find required JS files in ${distPath}`);
    }

    console.log('Found files:', { polyfillsFile, mainFile, styleFile });

    // Ensure WordPress plugin dist directory exists
    await fs.ensureDir(wpPluginPath);

    // Create a temporary entry file that combines the imports
    const entryContent = `
      import './polyfills-${polyfillsFile.split('-')[1]}';
      import './main-${mainFile.split('-')[1]}';
      export default {};
    `;
    const entryFile = path.join(distPath, 'entry.js');
    await fs.writeFile(entryFile, entryContent);

    // Bundle with Rollup using updated configuration
    const bundle = await rollup.rollup({
      input: entryFile,
      output: {
        file: path.join(wpPluginPath, 'agent-ai-bot-protect.js'),
        format: 'es',
        inlineDynamicImports: true
      }
    });

    await bundle.write({
      file: path.join(wpPluginPath, 'agent-ai-bot-protect.js'),
      format: 'es',
      inlineDynamicImports: true
    });

    // Clean up entry file
    await fs.remove(entryFile);
    
    console.log('JS bundle created successfully!');

    // Copy styles if they exist
    if (styleFile) {
      await fs.copy(
        path.join(distPath, styleFile),
        path.join(wpPluginPath, 'agent-ai-bot-protect.css')
      );
      console.log('Styles copied successfully!');
    }

    // Read and update the JS file
    const jsFilePath = path.join(wpPluginPath, 'agent-ai-bot-protect.js');
    let jsContent = await fs.readFile(jsFilePath, 'utf8');
    jsContent = jsContent.replace(
      /["'](\.?\/?)?assets\//g,
      '"/wp-content/plugins/agent-ai-bot-protect/dist/assets/'
    );

    // Replace URLs in the /media/ path
    jsContent = jsContent.replace(
      /url\(["']?\.\/media\/(.*?)["']?\)/g,
      'url("/wp-content/plugins/agent-ai-bot-protect/dist/media/$1")'
    );

    await fs.writeFile(jsFilePath, jsContent);
    console.log('JS asset paths updated successfully!');

    // Read and update the CSS file
    const cssFilePath = path.join(wpPluginPath, 'agent-ai-bot-protect.css');
    let cssContent = await fs.readFile(cssFilePath, 'utf8');
    cssContent = cssContent.replace(
      /url\(['"]?(\.?\/?)?assets\//g,
      'url(/wp-content/plugins/agent-ai-bot-protect/dist/assets/'
    );
    await fs.writeFile(cssFilePath, cssContent);
    console.log('CSS asset paths updated successfully!');

    // Copy assets directory
    const assetsPath = path.join(distPath, 'assets');
    await fs.copy(assetsPath, path.join(wpPluginPath, 'assets'), {
      overwrite: true
    });
    console.log('Assets directory copied successfully!');

    // Copy media directory
    const mediaPath = path.join(distPath, 'media');
    await fs.copy(mediaPath, path.join(wpPluginPath, 'media'), {
      overwrite: true
    });
    console.log('Media directory copied successfully!');

    console.log('Build completed successfully!');
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
})(); 