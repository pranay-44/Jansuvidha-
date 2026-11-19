import {input,password,select} from '@inquirer/prompts';
import {randomUUID} from 'node:crypto';
import {connectDatabase,rows,transaction} from './db.mjs';
import {email,text,validatePassword,hashPassword,assertLocalPrototype} from './auth-security.mjs';
import {audit,issueToken,accountLink} from './accounts.mjs';

const pool=connectDatabase();
try {
  const command=process.argv[2];
  if(command==='bootstrap') {
    const name=text(await input({message:'Administrator name:'}));
    const address=email(await input({message:'Official email:'}));
    const secret=await password({message:'Password (15–128 characters):'});
    await validatePassword(secret,await password({message:'Confirm password:'}));
    const hash=await hashPassword(secret),id=randomUUID();
    const db=await pool.getConnection();
    try {
      const [lock]=await rows(db,"SELECT GET_LOCK('jansuvidha-bootstrap',10) AS acquired");
      if(!lock.acquired)throw Error('Another bootstrap is running.');
      await db.beginTransaction();
      if((await rows(db,"SELECT id FROM users WHERE role='ADMIN'")).length)throw Error('Administrator already exists. Bootstrap refused.');
      await rows(db,"INSERT INTO users(id,role,name,official_email,password_hash,status) VALUES (?,'ADMIN',?,?,?,'ACTIVE')",[id,name,address,hash]);
      await audit(db,id,'ADMIN_BOOTSTRAPPED','user',id);await db.commit();console.log('First administrator created. Sign in through Government portal.');
    }catch(e){await db.rollback();throw e;}finally{await db.query("SELECT RELEASE_LOCK('jansuvidha-bootstrap')");db.release();}
  }else if(command==='dev-link') {
    assertLocalPrototype();
    if(process.env.NODE_ENV!=='development')throw Error('Development links require NODE_ENV=development.');
    const address=email(await input({message:'Staff official email:'}));
    const kind=await select({message:'Link type:',choices:[{name:'Officer invitation',value:'INVITATION'},{name:'Staff password reset',value:'STAFF_RESET'}]});
    const secret=await transaction(pool,async db=>{
      const [u]=await rows(db,"SELECT * FROM users WHERE official_email=? AND role IN ('OFFICER','ADMIN') FOR UPDATE",[address]);
      if(!u||u.status!==(kind==='INVITATION'?'PENDING':'ACTIVE')||(kind==='INVITATION'&&u.role!=='OFFICER'))throw Error('No eligible staff account.');
      await audit(db,null,'DEV_LINK_ISSUED','user',u.id);return issueToken(db,u.id,kind);
    });
    console.log('DEVELOPMENT ONLY — copy privately; do not log or share this link:');
    console.log(accountLink(kind,secret));
  }else throw Error('Use npm run auth:bootstrap or npm run auth:dev-link.');
}catch(e){console.error(e.status||!e.code?e.message:'Account command failed. Check database configuration.');process.exitCode=1;}
finally{await pool.end();}
