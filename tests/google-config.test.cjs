const test = require("node:test"), assert = require("node:assert/strict");
const fs=require("node:fs"), os=require("node:os"),path=require("node:path");
const {filename,publisherConfig,loadConfig,missing}=require("../src/google-config.cjs");
test("release settings work without runtime env and forks cannot mix projects",t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),"glint-config-"));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const settings={GOOGLE_CLIENT_ID:"test-id",GOOGLE_CLIENT_SECRET:"test-secret",GOOGLE_PICKER_KEY:"test-key",GOOGLE_PROJECT_NUMBER:"123"};
 assert.throws(()=>publisherConfig({}),/Missing release settings/);
 fs.writeFileSync(path.join(dir,filename),JSON.stringify(publisherConfig({...settings,EXTRA:"excluded"})));
 assert.deepEqual(loadConfig(dir,{}),settings);
 assert.equal(missing(loadConfig(dir,{GOOGLE_CLIENT_ID:"fork"})).length,3);
});
