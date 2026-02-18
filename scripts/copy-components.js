// SPDX-FileCopyrightText: 2023 XWiki CryptPad Team <contact@cryptpad.org> and contributors
//
// SPDX-License-Identifier: AGPL-3.0-or-later

const Fs = require("fs");
const Fse = require("fs-extra");
const Path = require("path");

const componentsPath = Path.join("www", "components");
const oldComponentsPath = Path.join("www", "bower_components");
Fse.mkdirpSync(componentsPath);
Fse.rmSync(oldComponentsPath, { recursive: true, force: true });

[
    "alertify.js",
    "bootstrap",
    "bootstrap-tokenfield",
    "chainpad",
    "chainpad-listmap",
    "chainpad-netflux",
    "ckeditor",
    "codemirror",
    "components-font-awesome",
    "croppie",
    "file-saver",
    "hyper-json",
    "jquery",
    "json.sortify",
    "jszip",
    "dragula",
    "html2canvas",
    "localforage",
    "marked",
    "mathjax",
    "open-sans-fontface",
    "tweetnacl",
    "tweetnacl-util",
    "require-css",
    "requirejs",
    "requirejs-plugins",
    "scrypt-async",
    "sortablejs",
    // both client and server:
    "chainpad-crypto",
    "saferphore",
    "nthen",
    "netflux-websocket",
    "drawio",
    "pako",
    "x2js"
].forEach(l => {
    let s = l;
    if (s === 'tweetnacl') {
        //s += '-old';
    }
    const source = Path.join("node_modules", s);
    const destination = Path.join(componentsPath, l);
    Fs.rmSync(destination, { recursive: true, force: true });
    Fs.cpSync(source, destination, { recursive: true });
});

// marked UMD uses a named AMD define ("marked") which breaks RequireJS
// path-based loading. Patch it to anonymous define to preserve legacy loading.
var markedUmd = Path.join(componentsPath, "marked", "lib", "marked.umd.js");
if (Fs.existsSync(markedUmd)) {
    var content = Fs.readFileSync(markedUmd, 'utf8');
    var amdNamedDefinePattern = /define\((['"])marked\1,\s*([A-Za-z_$][\w$]*)\)/;
    var patched = content.replace(amdNamedDefinePattern, 'define($2)');
    if (patched === content) {
        throw new Error("Unable to patch marked UMD AMD define signature");
    }
    Fs.writeFileSync(markedUmd, patched, 'utf8');
}
