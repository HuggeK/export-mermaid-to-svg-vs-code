const vscode = require('vscode');
const path = require('path');

function isExportable(document) {
  const ext = path.extname(document.fileName).toLowerCase();
  return ext === '.mmd' || ext === '.md' || ext === '.markdown';
}

function activate(context) {
  const configPath = path.join(context.extensionPath, 'mermaid-config.json');
  const mdScriptPath = path.join(context.extensionPath, 'export-mermaid-from-markdown.js');

  // Markdown Preview is a webview, not a text editor, so activeTextEditor is
  // undefined while it's focused. Remember the last real .mmd/.md editor so
  // the button still knows which file to export when invoked from Preview.
  let lastEditor = vscode.window.activeTextEditor && isExportable(vscode.window.activeTextEditor.document)
    ? vscode.window.activeTextEditor
    : undefined;
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor && isExportable(editor.document)) {
        lastEditor = editor;
      }
    })
  );

  const disposable = vscode.commands.registerCommand('mermaidTaskButton.export', async () => {
    const editor = vscode.window.activeTextEditor || lastEditor;
    if (!editor) {
      vscode.window.showWarningMessage('Open a .mmd or .md file first.');
      return;
    }

    const doc = editor.document;
    if (doc.isUntitled) {
      vscode.window.showWarningMessage('Save this file before exporting.');
      return;
    }
    if (doc.isDirty) {
      await doc.save();
    }

    const filePath = doc.fileName;
    const ext = path.extname(filePath).toLowerCase();
    const dir = path.dirname(filePath);

    let command;
    let args;
    let taskName;
    if (ext === '.mmd') {
      const outPath = filePath.slice(0, -ext.length) + '.svg';
      command = 'npx';
      args = [
        '-y',
        '-p',
        '@mermaid-js/mermaid-cli',
        'mmdc',
        '-i',
        filePath,
        '-o',
        outPath,
        '-b',
        'transparent',
        '-c',
        configPath,
      ];
      taskName = 'Export Mermaid to SVG';
    } else if (ext === '.md' || ext === '.markdown') {
      command = 'node';
      args = [mdScriptPath, filePath, 'svg'];
      taskName = 'Export All Mermaid Diagrams in Markdown';
    } else {
      vscode.window.showWarningMessage('This only works for .mmd or .md files.');
      return;
    }

    const scope =
      vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0
        ? vscode.TaskScope.Workspace
        : vscode.TaskScope.Global;

    // Pass command + args as an array (not a pre-joined string) so VS Code
    // applies correct per-shell quoting itself — a manually-quoted string
    // handed to ShellExecution gets re-parsed by the shell wrapper (e.g.
    // PowerShell's -Command) and can split paths containing spaces.
    const task = new vscode.Task(
      { type: 'shell' },
      scope,
      taskName,
      'Mermaid Export',
      new vscode.ShellExecution(command, args, { cwd: dir })
    );
    task.presentationOptions = {
      reveal: vscode.TaskRevealKind.Always,
      panel: vscode.TaskPanelKind.Shared,
      clear: true,
    };

    vscode.tasks.executeTask(task);
  });

  context.subscriptions.push(disposable);
}

function deactivate() {}

module.exports = { activate, deactivate };
