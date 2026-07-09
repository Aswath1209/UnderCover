require('dotenv').config();
console.log("Env keys:", Object.keys(process.env).filter(k => !k.includes("KEY") && !k.includes("TOKEN") && !k.includes("PASSWORD") && !k.includes("SECRET")));
