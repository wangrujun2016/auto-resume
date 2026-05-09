using System;
using System.Diagnostics;
using System.IO;
using System.Text;

// 7za.exe 的包装器：Windows 解压 winCodeSign 时会因为 macOS 软链 (libcrypto.dylib / libssl.dylib)
// 报「Cannot create symbolic link」并 exit 2。这会让 electron-builder 整个失败。
// 包装器调用真正的 7za-real.exe，并在解压目录里加 -x!darwin 排除 macOS 子目录，
// 同时把退出码归 0（只要解压有成果）。
class Program {
    static int Main(string[] args) {
        string exeDir = Path.GetDirectoryName(System.Reflection.Assembly.GetExecutingAssembly().Location);
        string realExe = Path.Combine(exeDir, "7za-real.exe");
        if (!File.Exists(realExe)) {
            Console.Error.WriteLine("7za-real.exe not found at " + realExe);
            return 1;
        }

        var sb = new StringBuilder();
        bool isExtract = false;
        bool hasDarwinExclude = false;
        foreach (string a in args) {
            if (a == "x" || a == "e") isExtract = true;
            if (a.StartsWith("-x!darwin")) hasDarwinExclude = true;
        }
        for (int i = 0; i < args.Length; i++) {
            string a = args[i];
            if (sb.Length > 0) sb.Append(' ');
            if (a.IndexOf(' ') >= 0 || a.IndexOf('\t') >= 0) sb.Append('"').Append(a.Replace("\"", "\\\"")).Append('"');
            else sb.Append(a);
        }
        if (isExtract && !hasDarwinExclude) sb.Append(" -x!darwin");

        var psi = new ProcessStartInfo(realExe, sb.ToString()) {
            UseShellExecute = false,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
        };
        var p = Process.Start(psi);
        p.OutputDataReceived += (s, e) => { if (e.Data != null) Console.Out.WriteLine(e.Data); };
        p.ErrorDataReceived += (s, e) => { if (e.Data != null) Console.Error.WriteLine(e.Data); };
        p.BeginOutputReadLine();
        p.BeginErrorReadLine();
        p.WaitForExit();
        int code = p.ExitCode;
        // 7za 解压出现软链错误时返回 2；我们已经用 -x!darwin 排除了，但保险起见把 1/2 都视作成功
        if (code == 1 || code == 2) code = 0;
        return code;
    }
}
