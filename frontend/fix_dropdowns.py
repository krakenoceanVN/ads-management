import re

def fix_advertiser():
    with open('src/pages/Advertiser.tsx', 'r', encoding='utf-8') as f:
        text = f.read()

    # AdOrderMgmt
    text = text.replace(
        "const [search, setSearch] = React.useState('');\n  const { t, db, openModal, advName } = useAppContext();",
        "const [search, setSearch] = React.useState('');\n  const [advFilter, setAdvFilter] = React.useState('');\n  const { t, db, openModal, advName } = useAppContext();"
    )
    text = text.replace(
        "<select className=\"filter-select\"><option value=\"\">{t('filterAdv')}</option>{db.advertisers.map(a => <option key={a.id}>{a.name}</option>)}</select>",
        "<select className=\"filter-select\" value={advFilter} onChange={e => setAdvFilter(e.target.value)}><option value=\"\">{t('filterAdv')}</option>{db.advertisers.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>"
    )
    text = text.replace(
        "data={db.adOrders.filter(x => x.name.includes(search))}",
        "data={db.adOrders.filter(x => x.name.includes(search) && (!advFilter || x.advId == advFilter))}"
    )

    # AdIdMgmt
    text = text.replace(
        "const [search, setSearch] = React.useState('');\n  const { t, db, openModal, advName, orderName } = useAppContext();",
        "const [search, setSearch] = React.useState('');\n  const [advFilter, setAdvFilter] = React.useState('');\n  const [orderFilter, setOrderFilter] = React.useState('');\n  const [typeFilter, setTypeFilter] = React.useState('');\n  const { t, db, openModal, advName, orderName } = useAppContext();"
    )
    text = text.replace(
        "<select className=\"filter-select\"><option value=\"\">{t('adOrder')}</option>{db.adOrders.map(o => <option key={o.id}>{o.name}</option>)}</select>",
        "<select className=\"filter-select\" value={orderFilter} onChange={e => setOrderFilter(e.target.value)}><option value=\"\">{t('adOrder')}</option>{db.adOrders.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select>"
    )
    text = text.replace(
        "<select className=\"filter-select\"><option value=\"\">{t('filterType')}</option><option>CPM</option><option>CPS</option></select>",
        "<select className=\"filter-select\" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}><option value=\"\">{t('filterType')}</option><option value=\"CPM\">CPM</option><option value=\"CPS\">CPS</option></select>"
    )
    text = text.replace(
        "data={db.adIds.filter(x => x.slot.includes(search))}",
        "data={db.adIds.filter(x => x.slot.includes(search) && (!advFilter || x.advId == advFilter) && (!orderFilter || x.orderId == orderFilter) && (!typeFilter || x.type === typeFilter))}"
    )

    with open('src/pages/Advertiser.tsx', 'w', encoding='utf-8') as f:
        f.write(text)

def fix_media():
    with open('src/pages/Media.tsx', 'r', encoding='utf-8') as f:
        text = f.read()

    # MediaAdOrderMgmt
    text = text.replace(
        "const [search, setSearch] = React.useState('');\n  const { t, db, openModal, mediaName } = useAppContext();",
        "const [search, setSearch] = React.useState('');\n  const [mediaFilter, setMediaFilter] = React.useState('');\n  const { t, db, openModal, mediaName } = useAppContext();"
    )
    text = text.replace(
        "<select className=\"filter-select\"><option value=\"\">{t('filterMedia')}</option>{db.media.map(m => <option key={m.id}>{m.name}</option>)}</select>",
        "<select className=\"filter-select\" value={mediaFilter} onChange={e => setMediaFilter(e.target.value)}><option value=\"\">{t('filterMedia')}</option>{db.media.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select>"
    )
    text = text.replace(
        "data={db.mediaOrders.filter(x => x.name.includes(search))}",
        "data={db.mediaOrders.filter(x => x.name.includes(search) && (!mediaFilter || x.mediaId == mediaFilter))}"
    )
    
    # MediaIdMgmt
    text = text.replace(
        "const [search, setSearch] = React.useState('');\n  const { t, db, openModal, mediaName, mediaOrderName } = useAppContext();",
        "const [search, setSearch] = React.useState('');\n  const [mediaFilter, setMediaFilter] = React.useState('');\n  const [orderFilter, setOrderFilter] = React.useState('');\n  const [typeFilter, setTypeFilter] = React.useState('');\n  const { t, db, openModal, mediaName, mediaOrderName } = useAppContext();"
    )
    text = text.replace(
        "<select className=\"filter-select\"><option value=\"\">{t('mediaAdOrder')}</option>{db.mediaOrders.map(o => <option key={o.id}>{o.name}</option>)}</select>",
        "<select className=\"filter-select\" value={orderFilter} onChange={e => setOrderFilter(e.target.value)}><option value=\"\">{t('mediaAdOrder')}</option>{db.mediaOrders.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select>"
    )
    text = text.replace(
        "<select className=\"filter-select\"><option value=\"\">{t('filterType')}</option><option>CPM</option><option>CPS</option></select>",
        "<select className=\"filter-select\" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}><option value=\"\">{t('filterType')}</option><option value=\"CPM\">CPM</option><option value=\"CPS\">CPS</option></select>"
    )
    text = text.replace(
        "data={db.mediaIds.filter(x => x.slot.includes(search))}",
        "data={db.mediaIds.filter(x => x.slot.includes(search) && (!mediaFilter || x.mediaId == mediaFilter) && (!orderFilter || x.orderId == orderFilter) && (!typeFilter || x.type === typeFilter))}"
    )

    with open('src/pages/Media.tsx', 'w', encoding='utf-8') as f:
        f.write(text)

fix_advertiser()
fix_media()
