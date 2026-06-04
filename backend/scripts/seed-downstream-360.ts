import { prisma } from '../src/shared/prisma/client';
import { Prisma } from '@prisma/client';
async function main(){
  const at = await prisma.adType.findUnique({where:{code:'TEST360'}});
  if(!at) throw new Error('AdType TEST360 not found');
  let ds = await prisma.downstream.findFirst({where:{downstreamType:'ML',adTypeId:at.id}});
  if(!ds){ ds = await prisma.downstream.create({data:{adTypeId:at.id,downstreamType:'ML',payoutRate:new Prisma.Decimal('0.9'),status:'active'}}); console.log('Created Downstream ML360 id=',ds.id);}
  else console.log('Downstream exists id=',ds.id);
  const p = await prisma.downstreamPeriod.findFirst({where:{downstreamId:ds.id}});
  if(!p){ const np=await prisma.downstreamPeriod.create({data:{downstreamId:ds.id,unitPrice:new Prisma.Decimal('0.9'),pctHal:new Prisma.Decimal('0.8'),startDate:new Date('2026-03-01T00:00:00.000Z'),endDate:null,note:'360 test'}}); console.log('Created period id=',np.id);}
  else console.log('Period exists id=',p.id);
  for(const name of ['6-wap端(716)','1-wap端(674)']){
    const site=await prisma.adSite.findFirst({where:{name,upstream:{adType:{code:'TEST360'}}}});
    if(!site){console.log('site not found',name);continue;}
    const j=await prisma.adSiteDownstream.upsert({where:{adSiteId_downstreamId:{adSiteId:site.id,downstreamId:ds.id}},update:{},create:{adSiteId:site.id,downstreamId:ds.id,customPrice:null}});
    console.log('junction',name,'site',site.id,'->ds',ds.id,'jid',j.id);
  }
  console.log('DONE');
}
main().catch(e=>{console.error(e);process.exit(1);});
