'use strict';
const path=require('node:path');
const {existsSync}=require('node:fs');
function selectUserData(appData,currentDirectory,packaged=false){
  const legacy=packaged?['Project Kratos','project-kratos']:['project-kratos','Project Kratos'];
  const names=['NXE','nxe-launcher',...legacy];
  const defaults=names.map(name=>path.join(appData,name));
  // Respect explicit userData overrides used by custom deployments and tests.
  if(!defaults.some(directory=>path.resolve(directory)===path.resolve(currentDirectory)))return currentDirectory;
  return defaults.find(directory=>existsSync(path.join(directory,'library.json'))) || defaults[0];
}
module.exports={selectUserData};
