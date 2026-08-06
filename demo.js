const { downdetector } = require('./index');

// UTC ISO ժամանակը -> տեղական ժամ (համակարգի timezone-ով, օր. Հայաստան +4)
function toLocal(iso) {
  return new Date(iso).toLocaleString('hy-AM', { hour12: false });
}

// Ընկերությունն ու domain-ը կարող ես փոխել այստեղ (կամ command line-ից)
const company = process.argv[2] || 'facebook';
const domain = process.argv[3] || 'com';

(async () => {
  console.log(`\nՎերցնում եմ տվյալները: ${company} (downdetector.${domain}) ...\n`);
  const res = await downdetector(company, domain);

  if (!res || !res.reports.length) {
    console.log('Տվյալներ չգտնվեցին (ընկերության անունը սխալ է կամ էջը հասանելի չէ):');
    return;
  }

  const { reports, baseline } = res;
  const latest = reports[reports.length - 1];
  const peak = reports.reduce((a, b) => (b.value > a.value ? b : a));
  const total = reports.reduce((sum, p) => sum + p.value, 0);
  const avg = (total / reports.length).toFixed(1);

  console.log('=== ՎԻՃԱԿԱԳՐՈՒԹՅՈՒՆ (վերջին 24 ժամ) ===');
  console.log(`Կետերի քանակ:          ${reports.length} (15 րոպեանոց քայլ)`);
  console.log(`Վերջին արժեք:          ${latest.value} ռեպորտ  (տեղական: ${toLocal(latest.date)})`);
  console.log(`Առավելագույն (peak):   ${peak.value} ռեպորտ  (տեղական: ${toLocal(peak.date)})`);
  console.log(`Միջին:                 ${avg} ռեպորտ/կետ`);
  console.log(`Ընդհանուր ռեպորտներ:   ${total}`);

  console.log('\n=== ՎԵՐՋԻՆ 5 ԿԵՏ (տեղական ժամ | reports vs baseline) ===');
  reports.slice(-5).forEach((r, i) => {
    const b = baseline[baseline.length - 5 + i];
    console.log(`${toLocal(r.date)}  reports: ${String(r.value).padStart(4)}  |  baseline: ${b.value}`);
  });

  console.log('');
})();
