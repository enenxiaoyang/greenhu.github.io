(function () {
  const LS_KEY = 'gh:listings:v1';

  const categoryName = (c) => ({
    paper: '纸类',
    plastic: '塑料',
    metal: '金属',
    textile: '旧衣物',
    ewaste: '电子废弃物',
    glass: '玻璃',
    other: '其他',
  }[c] || '其他');

  const typeName = (t) => (t === 'buy' ? '收' : '出');

  const load = () => {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); }
    catch { return []; }
  };
  const save = (arr) => localStorage.setItem(LS_KEY, JSON.stringify(arr));

  const uid = () => Math.random().toString(16).slice(2) + Date.now().toString(16);

  const calcAvoidedCO2 = (category, kg) => {
    // 非权威示例因子：用来“展示量化”，你可以按资料替换
    const factors = { paper: 1.3, plastic: 2.0, metal: 4.0, textile: 3.0, ewaste: 6.0, glass: 0.3, other: 1.0 };
    return (factors[category] ?? 1.0) * kg;
  };

  const listingCard = (item) => {
    const avoided = calcAvoidedCO2(item.category, item.weightKg);
    const badgeCls = item.type === 'buy' ? 'buy' : 'sell';
    const created = new Date(item.createdAt).toLocaleString();

    const note = (item.note || '').trim();
    const noteHtml = note ? `<p class="muted small" style="margin:8px 0 0;">${escapeHtml(note)}</p>` : '';

    return `
      <article class="listing">
        <div class="row space-between">
          <span class="badge ${badgeCls}">${typeName(item.type)}</span>
          <span class="muted small">${created}</span>
        </div>
        <h4>${escapeHtml(item.title)}</h4>
        <div class="meta">
          <span>分类：${categoryName(item.category)}</span>
          <span>数量：${Number(item.weightKg).toFixed(1)} kg</span>
          <span>价格：${Number(item.priceYuan).toFixed(1)} 元</span>
        </div>
        <div class="meta" style="margin-top:6px;">
          <span>地点：${escapeHtml(item.location)}</span>
          <span>联系：${escapeHtml(item.contact)}</span>
        </div>
        ${noteHtml}
        <div class="meta" style="margin-top:10px;">
          <span>预计减排：<strong>${avoided.toFixed(1)}</strong> kg CO₂e（示例）</span>
        </div>
        <div class="actions">
          <button class="btn btn-ghost" data-act="copy" data-id="${item.id}" type="button">复制联系</button>
          <button class="btn btn-ghost danger" data-act="del" data-id="${item.id}" type="button">删除</button>
        </div>
      </article>
    `;
  };

  function escapeHtml(s) {
    return String(s)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  const form = document.getElementById('listingForm');
  const hint = document.getElementById('formHint');
  const grid = document.getElementById('listingGrid');
  const emptyHint = document.getElementById('emptyHint');

  const filterType = document.getElementById('filterType');
  const filterCategory = document.getElementById('filterCategory');
  const searchQ = document.getElementById('searchQ');

  const btnSeed = document.getElementById('btnSeed');
  const btnClear = document.getElementById('btnClear');

  if (!grid) return;

  const render = () => {
    const items = load();

    const t = filterType?.value || 'all';
    const c = filterCategory?.value || 'all';
    const q = (searchQ?.value || '').trim().toLowerCase();

    const filtered = items.filter(it => {
      if (t !== 'all' && it.type !== t) return false;
      if (c !== 'all' && it.category !== c) return false;
      if (!q) return true;
      const hay = `${it.title} ${it.location} ${it.note || ''}`.toLowerCase();
      return hay.includes(q);
    });

    grid.innerHTML = filtered.map(listingCard).join('');
    emptyHint.textContent = filtered.length ? '' : '暂无匹配结果。试试生成示例数据，或发布一条新信息。';

    // Update homepage stats if those elements exist on same page (defensive)
    updateStats(items);
  };

  const updateStats = (items) => {
    const statListings = document.getElementById('statListings');
    const statKg = document.getElementById('statKg');
    const statCO2 = document.getElementById('statCO2');
    if (!statListings || !statKg || !statCO2) return;

    const totalKg = items.reduce((a, x) => a + Number(x.weightKg || 0), 0);
    const totalCO2 = items.reduce((a, x) => a + calcAvoidedCO2(x.category, Number(x.weightKg || 0)), 0);

    statListings.textContent = String(items.length);
    statKg.textContent = totalKg.toFixed(1);
    statCO2.textContent = totalCO2.toFixed(1);
  };

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const data = new FormData(form);

      const item = {
        id: uid(),
        type: String(data.get('type') || 'sell'),
        category: String(data.get('category') || 'other'),
        title: String(data.get('title') || '').trim(),
        weightKg: Number(data.get('weightKg') || 0),
        priceYuan: Number(data.get('priceYuan') || 0),
        location: String(data.get('location') || '').trim(),
        contact: String(data.get('contact') || '').trim(),
        note: String(data.get('note') || '').trim(),
        createdAt: Date.now(),
      };

      if (!item.title || !item.location || !item.contact || !(item.weightKg > 0)) {
        if (hint) hint.textContent = '请把标题/数量/地点/联系方式填写完整。';
        return;
      }

      const items = load();
      items.unshift(item);
      save(items);

      if (hint) hint.textContent = '发布成功（本地保存）。';
      form.reset();
      render();
    });
  }

  grid.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const act = btn.getAttribute('data-act');
    const id = btn.getAttribute('data-id');

    const items = load();
    const idx = items.findIndex(x => x.id === id);
    if (idx < 0) return;

    if (act === 'del') {
      if (!confirm('确定删除这条信息吗？')) return;
      items.splice(idx, 1);
      save(items);
      render();
    }

    if (act === 'copy') {
      const text = items[idx].contact;
      try {
        await navigator.clipboard.writeText(text);
        btn.textContent = '已复制';
        setTimeout(() => (btn.textContent = '复制联系'), 800);
      } catch {
        alert('复制失败：浏览器不允许或缺少权限。你可以手动复制。');
      }
    }
  });

  [filterType, filterCategory, searchQ].forEach(el => {
    if (!el) return;
    el.addEventListener('input', render);
    el.addEventListener('change', render);
  });

  if (btnSeed) {
    btnSeed.addEventListener('click', () => {
      const now = Date.now();
      const seed = [
        { type:'sell', category:'paper', title:'出干净纸箱一批', weightKg: 15, priceYuan: 18, location:'XX区A地铁站附近', contact:'微信：green_123', note:'晚上可自提', createdAt: now - 3600e3 },
        { type:'buy',  category:'ewaste', title:'收旧手机/平板（可坏）', weightKg: 3, priceYuan: 80, location:'XX区', contact:'电话：138****0000', note:'可上门', createdAt: now - 7200e3 },
        { type:'sell', category:'plastic', title:'出塑料瓶（已清洗）', weightKg: 6.5, priceYuan: 10, location:'XX路', contact:'微信：recycle_me', note:'周末方便', createdAt: now - 9200e3 },
        { type:'sell', category:'metal', title:'出废铝/铁边角料', weightKg: 22, priceYuan: 120, location:'XX工业园', contact:'微信：metal_ok', note:'需自提', createdAt: now - 12200e3 },
      ].map(x => ({ id: uid(), ...x }));

      const items = load();
      save([...seed, ...items]);
      if (hint) hint.textContent = '已生成示例数据。';
      render();
    });
  }

  if (btnClear) {
    btnClear.addEventListener('click', () => {
      if (!confirm('确定清空全部挂牌吗？（不可恢复）')) return;
      save([]);
      render();
      if (hint) hint.textContent = '已清空。';
    });
  }

  render();
})();
