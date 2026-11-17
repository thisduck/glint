const fs = require("node:fs");
const {execFileSync}=require("node:child_process");
if(process.platform==="darwin"){
  fs.mkdirSync("dist",{recursive:true});
  execFileSync("/usr/bin/clang",["-Os","native/window-bounds.c","-framework","ApplicationServices","-o","dist/window-bounds"],{stdio:"inherit"});
}
