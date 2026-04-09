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

// tweetnacl exports to self.nacl (global) but does not call define().
// RequireJS hangs waiting for define() — append an AMD shim.
var naclMin = Path.join(componentsPath, "tweetnacl", "nacl-fast.min.js");
if (Fs.existsSync(naclMin)) {
    var naclContent = Fs.readFileSync(naclMin, 'utf8');
    if (!naclContent.includes('define.amd')) {
        naclContent += '\nif(typeof define==="function"&&define.amd){define(function(){return self.nacl;});}';
        Fs.writeFileSync(naclMin, naclContent, 'utf8');
    }
}

// scrypt-async exports global scrypt but does not call define().
var scryptMin = Path.join(componentsPath, "scrypt-async", "scrypt-async.min.js");
if (Fs.existsSync(scryptMin)) {
    var scryptContent = Fs.readFileSync(scryptMin, 'utf8');
    if (!scryptContent.includes('define.amd')) {
        scryptContent += '\nif(typeof define==="function"&&define.amd){define(function(){return scrypt;});}';
        Fs.writeFileSync(scryptMin, scryptContent, 'utf8');
    }
}
