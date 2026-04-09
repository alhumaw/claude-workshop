import * as pty from 'node-pty';
import { randomBytes } from 'crypto';

interface ShellInstance {
  id: string;
  pty: pty.IPty;
  onDataCallback?: (data: string) => void;
}

export class ShellTerminal {
  private instances = new Map<string, ShellInstance>();

  spawn(cwd?: string): string {
    const id = randomBytes(6).toString('hex');
    const shell = process.env.SHELL || '/bin/zsh';
    const workingDir = cwd || process.env.HOME || '/';

    const ptyProcess = pty.spawn(shell, ['-l'], {
      name: 'xterm-256color',
      cwd: workingDir,
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
      },
      cols: 120,
      rows: 15,
    });

    const instance: ShellInstance = { id, pty: ptyProcess };
    this.instances.set(id, instance);

    ptyProcess.onData((data) => {
      if (instance.onDataCallback) {
        instance.onDataCallback(data);
      }
    });

    ptyProcess.onExit(() => {
      this.instances.delete(id);
    });

    return id;
  }

  write(id: string, data: string): void {
    const inst = this.instances.get(id);
    if (inst) {
      try { inst.pty.write(data); } catch {}
    }
  }

  resize(id: string, cols: number, rows: number): void {
    const inst = this.instances.get(id);
    if (inst) {
      try { inst.pty.resize(cols, rows); } catch {}
    }
  }

  kill(id: string): void {
    const inst = this.instances.get(id);
    if (inst) {
      inst.pty.kill();
      this.instances.delete(id);
    }
  }

  setOnData(id: string, callback: (data: string) => void): void {
    const inst = this.instances.get(id);
    if (inst) {
      inst.onDataCallback = callback;
    }
  }

  killAll(): void {
    for (const [id] of this.instances) {
      this.kill(id);
    }
  }

  listIds(): string[] {
    return Array.from(this.instances.keys());
  }
}
