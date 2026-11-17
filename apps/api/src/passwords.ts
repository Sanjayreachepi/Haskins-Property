import { scrypt,randomBytes,timingSafeEqual } from "node:crypto";
let active=0;
/** Reject excess work immediately instead of building an unbounded crypto-worker queue. */
async function derive(password:string,salt:string):Promise<Buffer>{
 if(active>=4)throw Object.assign(Error("Sign-in service busy. Please try again shortly."),{status:503,retryAfter:1});
 active++;
 try{return await new Promise<Buffer>((resolve,reject)=>scrypt(password,salt,64,(error,key)=>error?reject(error):resolve(key)));}finally{active--;}
}
export async function passwordHashAsync(password:string){const salt=randomBytes(16).toString("hex");return salt+":"+(await derive(password,salt)).toString("hex");}
export async function passwordMatchesAsync(password:string,stored:string){
 const [rawSalt,rawKey]=stored.split(":");
 const valid=/^[a-f0-9]{32}$/i.test(rawSalt||"")&&/^[a-f0-9]{128}$/i.test(rawKey||"");
 const actual=await derive(password,valid?rawSalt:"0".repeat(32));
 const expected=Buffer.from(valid?rawKey:"0".repeat(128),"hex");
 return timingSafeEqual(actual,expected)&&valid;
}
