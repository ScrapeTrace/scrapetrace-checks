import json,csv,statistics,collections,pathlib
root=pathlib.Path(__file__).resolve().parents[1]
rows=[]
for dataset in ['disk','tmpfs']:
    data=json.loads((root/'raw'/f'{dataset}-measurements.json').read_text())
    for headless in [False,True]:
        for kind in ['persistent-default','nonpersistent-context']:
            for order in ['relaxed-first','alternating']:
                runs=[r['result'] for r in data['runs'] if r['headless']==headless and r['kind']==kind and r['order']==order]
                valid=[r for r in runs if r['status']=='measured' and r.get('medianRatio') is not None]
                values=[r['medianRatio'] for r in valid]
                if not values: continue
                low=sum(v<1.3 for v in values)
                rows.append(dict(dataset=dataset,headless=headless,context=kind,order=order,n=len(runs),measured=len(valid),median_ratio=statistics.median(values),min_ratio=min(values),max_ratio=max(values),below_1_30=low,at_or_above_1_30=len(values)-low,median_strict_block_ms=statistics.median(r['medianStrictMs'] for r in valid),median_relaxed_block_ms=statistics.median(r['medianRelaxedMs'] for r in valid),classification_errors=low if kind=='persistent-default' else len(values)-low))
(root/'raw/summary.json').write_text(json.dumps(rows,indent=2))
with (root/'raw/summary.csv').open('w') as f:
    writer=csv.DictWriter(f,fieldnames=list(rows[0]));writer.writeheader();writer.writerows(rows)
print('| Profile filesystem | Chrome | Context | n | Median ratio | Range | Below 1.30 |')
print('|---|---|---|---:|---:|---:|---:|')
for r in rows:
    if r['order']=='relaxed-first':print(f"| {r['dataset']} | {'headless' if r['headless'] else 'headed'} | {r['context']} | {r['n']} | {r['median_ratio']:.4f} | {r['min_ratio']:.4f}–{r['max_ratio']:.4f} | {r['below_1_30']} |")
