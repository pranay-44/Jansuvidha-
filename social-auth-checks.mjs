import assert from 'node:assert/strict';
import {beginAuthorization,validState,providerConfig,exchangeIdentity} from './social-auth.mjs';

const env={APP_ORIGIN:'http://127.0.0.1:4173',GOOGLE_CLIENT_ID:'google-id',GOOGLE_CLIENT_SECRET:'google-secret',FACEBOOK_APP_ID:'facebook-id',FACEBOOK_APP_SECRET:'facebook-secret',FACEBOOK_GRAPH_VERSION:'v99.0'};
assert.equal(providerConfig('unknown',env),null);
assert.equal(providerConfig('facebook',{...env,FACEBOOK_APP_SECRET:''}),null);
assert.equal(providerConfig('google',{...env,APP_ORIGIN:'http://public.example'}),null);
for(const provider of ['google','facebook']){
  const config=providerConfig(provider,env),{pending,url}=beginAuthorization(provider,config);
  const authorize=new URL(url);
  assert.equal(authorize.searchParams.get('redirect_uri'),config.callback);
  assert.equal(authorize.searchParams.get('response_type'),'code');
  assert.equal(authorize.searchParams.has('client_secret'),false);
  assert.ok(validState(pending,provider,pending.state));
  assert.equal(validState(pending,provider,'wrong'),false);
  assert.equal(validState(pending,'other',pending.state),false);
  assert.equal(validState({...pending,created:Date.now()-600001},provider,pending.state),false);
  if(provider==='google')assert.equal(authorize.searchParams.get('code_challenge_method'),'S256');
  let calls=0;
  const request=async(url,options)=>{
    assert.equal(options.redirect,'error');assert.ok(options.signal);calls++;
    if(String(url)===config.token){
      assert.equal(options.method,'POST');assert.equal(options.body.get('client_secret'),config.secret);
      assert.equal(options.body.get('redirect_uri'),config.callback);
      if(provider==='google')assert.equal(options.body.get('code_verifier'),pending.verifier);
      return {ok:true,json:async()=>({access_token:'access-token'})};
    }
    if(String(url).includes('/debug_token'))return {ok:true,json:async()=>({data:{is_valid:true,app_id:config.id,user_id:'subject',expires_at:Math.floor(Date.now()/1000)+3600}})};
    assert.equal(options.headers.Authorization,'Bearer access-token');
    if(provider==='facebook')assert.ok(new URL(url).searchParams.get('appsecret_proof'));
    return {ok:true,json:async()=>({id:'subject',sub:'subject',name:'Citizen'})};
  };
  assert.deepEqual(await exchangeIdentity(provider,config,'code',pending,request),{subject:'subject',name:'Citizen'});
  assert.equal(calls,provider==='google'?2:3);
  await assert.rejects(()=>exchangeIdentity(provider,config,'code',pending,async()=>({ok:false})));
  await assert.rejects(()=>exchangeIdentity(provider,config,'code',pending,async()=>({ok:true,json:async()=>({})})));
  if(provider==='facebook'){
    for(const data of [{is_valid:false},{is_valid:true,app_id:config.id,user_id:'subject'},{is_valid:true,app_id:'wrong',user_id:'subject',expires_at:9999999999},{is_valid:true,app_id:config.id,user_id:'other',expires_at:9999999999},{is_valid:true,app_id:config.id,user_id:'subject',expires_at:1}]){
      await assert.rejects(()=>exchangeIdentity(provider,config,'code',pending,(url,options)=>String(url).includes('/debug_token')?Promise.resolve({ok:true,json:async()=>({data})}):request(url,options)));
    }
  }
}
console.log('Passed: OAuth provider configuration, state/expiry, PKCE, token exchange, app/subject/expiry validation and provider failures.');
