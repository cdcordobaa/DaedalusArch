#!/usr/bin/env node
// Independent re-aggregation of the graph-fidelity corpora (audit tool, not the harness). `scripts/v1.3/graph-fidelity.ts`
// does not export its `aggregate()` (l.370-432); this is a re-implementation run on the COMMITTED per-project JSON of
// results/v1.3-fidelity/{e1,so4}/projects, so the corpus aggregates can be checked without ../daedalus-e1-outcomes or
// ../daedalus-so4. It takes from the committed aggregate.json only the project order (`perProject[].id`) and the
// fixed `note` text; every number is recomputed. adjudicationRows is the row count of the committed adjudication.csv.
// Usage: node fidelity-reaggregate.mjs <repo root> <out dir>   (writes <out>/{e1,so4}/aggregate.json)
import fs from 'node:fs';
const R = process.argv[2] + '/results/v1.3-fidelity/';
const r4=(x)=>Math.round(x*1e6)/1e6;
const cmp=(a,b)=>a<b?-1:a>b?1:0;
const REFS=['depcruise','tsc','union','intersection'];
const REASON=['path-alias','type-only','re-export/barrel','dynamic-import','require','out-of-root','index-resolution','.d.ts','excluded-file','extractor-bug'];
function micro(list){const s=list.reduce((a,x)=>({a:a.a+x.apgEdges,r:a.r+x.refEdges,b:a.b+x.both}),{a:0,r:0,b:0});const u=s.a+s.r-s.b;return{apgEdges:s.a,refEdges:s.r,both:s.b,onlyApg:s.a-s.b,onlyRef:s.r-s.b,refCoveredByApg:s.r===0?1:s.b/s.r,apgConfirmedByRef:s.a===0?1:s.b/s.a,jaccard:u===0?1:s.b/u};}
for (const c of ['e1','so4']) {
  const orig=JSON.parse(fs.readFileSync(R+c+'/aggregate.json','utf8'));
  const slug=(id)=>id.replaceAll('/','__');
  const summaries=orig.perProject.map(p=>JSON.parse(fs.readFileSync(R+c+'/projects/'+slug(p.id)+'.json','utf8')));
  const nFiles=fs.readdirSync(R+c+'/projects').filter(f=>f.endsWith('.json')).length;
  const adjRows=fs.readFileSync(R+c+'/adjudication.csv','utf8').split('\n').filter(l=>/^(disagreement|agreement-sample),/.test(l)).length;
  const variants=Object.keys(summaries[0].agreement);
  const ok=summaries.filter(s=>s.ok);
  const out={corpus:c,projects:summaries.length,measured:ok.length,failed:summaries.filter(s=>!s.ok).map(s=>({id:s.id,error:s.error})),depcruiseErrors:ok.filter(s=>s.meta.depcruiseError!==undefined).map(s=>s.id),seed:20261014,agreementSample:50,layerSample:40,adjudicationRows:adjRows,note:orig.note};
  const agg={};
  for(const v of variants){const per={};
    for(const r of REFS)for(const scope of ['scoped','raw']){
      const list=ok.map(s=>(scope==='scoped'?s.agreement:s.agreementRaw)?.[v]?.[r]).filter(x=>x!==undefined);
      const macro=f=>list.length===0?1:r4(list.reduce((n,a)=>n+f(a),0)/list.length);
      const min=f=>list.length===0?1:r4(Math.min(...list.map(f)));
      const m=micro(list);
      per[`${r}.${scope}`]={micro:{...m,refCoveredByApg:r4(m.refCoveredByApg),apgConfirmedByRef:r4(m.apgConfirmedByRef),jaccard:r4(m.jaccard)},
        macro:{refCoveredByApg:macro(a=>a.refCoveredByApg),apgConfirmedByRef:macro(a=>a.apgConfirmedByRef),jaccard:macro(a=>a.jaccard)},
        min:{refCoveredByApg:min(a=>a.refCoveredByApg),apgConfirmedByRef:min(a=>a.apgConfirmedByRef),jaccard:min(a=>a.jaccard)},
        projectsBelow095:{refCoveredByApg:list.filter(a=>a.refCoveredByApg<0.95).length,apgConfirmedByRef:list.filter(a=>a.apgConfirmedByRef<0.95).length},
        projectsWithAnyDisagreement:list.filter(a=>a.onlyApg+a.onlyRef>0).length};}
    const classes={depcruise:{},tsc:{}};
    for(const s of ok)for(const ref of ['depcruise','tsc'])for(const [l,n] of Object.entries(s.classes?.[v]?.[ref]??{}))classes[ref][l]=(classes[ref][l]??0)+n;
    for(const ref of ['depcruise','tsc'])classes[ref]=Object.fromEntries(Object.entries(classes[ref]).sort(([a],[b])=>cmp(a,b)));
    agg[v]={agreement:per,disagreementClasses:classes};}
  out.variants=agg; out.reasonClasses=REASON;
  const wl=ok.filter(s=>s.layer!==undefined);const tot=wl.reduce((n,s)=>n+s.layer.total,0);const asg=wl.reduce((n,s)=>n+s.layer.assigned,0);
  out.layer={projectsWithSpec:wl.length,files:tot,assigned:asg,fractionAssigned:tot===0?1:r4(asg/tot),minProjectFraction:Math.min(...wl.map(s=>s.layer.fractionAssigned)),inconsistencies:wl.reduce((n,s)=>n+s.layer.inconsistencies.length,0)};
  out.perProject=ok.map(s=>{const a=s.agreement[variants[0]];return{id:s.id,judged:s.meta.judged,apgEdges:a.tsc.apgEdges,tscEdges:a.tsc.refEdges,depcruiseEdges:a.depcruise.refEdges,dc:[r4(a.depcruise.refCoveredByApg),r4(a.depcruise.apgConfirmedByRef)],tsc:[r4(a.tsc.refCoveredByApg),r4(a.tsc.apgConfirmedByRef)],layerFraction:s.layer?.fractionAssigned};});
  const txt=JSON.stringify(out,null,1)+'\n';
  fs.mkdirSync(`${process.argv[3]}/${c}`,{recursive:true});
  fs.writeFileSync(`${process.argv[3]}/${c}/aggregate.json`,txt);
  console.log(c,'projects',nFiles);
}
