const Bundler = require('parcel-bundler');
const { ChildProcess, fork } = require('child_process');
const Path = require('path');
const fs = require('fs');

class App {
  bundler;
  processes = {};

  async init() {
    const sourceDir = Path.join(__dirname, 'src');
    const mainPath = Path.join(sourceDir, 'index.js');

    this.bundler = new Bundler(mainPath, {
      bundleNodeModules: true,
      target: 'node'
    });

    this.bundler.on('buildStart', bundle => {
      if (this.processes[bundle.name] instanceof ChildProcess) {
        this.processes[bundle.name].kill('SIGINT');
        this.processes[bundle.name] = null;
      }
    })

    this.bundler.on('bundled', bundle => {
      try {
        // start bundle as child process
        const child = fork(bundle.entryAsset.name, []);

        process.stdin.pipe(process.stdin);
        child.stdout.pipe(process.stdout);
        child.stderr.pipe(process.stderr);
        this.processes[bundle.name] = child;
      } catch (e) {
        // fail silently
      }
    });
  }

  async start() {
    await this.bundler.bundle();
  }

  close() {
    try {
      for (let name in this.processes) {
        if (this.processes[name] instanceof ChildProcess) {
          this.processes[name].kill('SIGINT');
        }
      }
    } catch (e) {
      //
    }
  }
}

(async () => {
  const app = new App();

  process.on('exit', app.close.bind(app));
  process.on('SIGINT', () => {
    process.exit(0);
  });
  process.on("uncaughtException", () => {
    process.exit(1);
  });

  try {
    await app.init();
    await app.start();
  } catch (e) {
    console.error(e.message);
  } finally {
    await app.close();
  }
})();
