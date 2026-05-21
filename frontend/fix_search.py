import re

def fix_file(path):
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    # Add search logic
    if "const [search, setSearch] = React.useState('');" not in content:
        content = content.replace("export function AdvertiserList() {", "export function AdvertiserList() {\n  const [search, setSearch] = React.useState('');")
        content = content.replace("export function AdOrderMgmt() {", "export function AdOrderMgmt() {\n  const [search, setSearch] = React.useState('');")
        content = content.replace("export function AdIdMgmt() {", "export function AdIdMgmt() {\n  const [search, setSearch] = React.useState('');")
        
        content = content.replace("export function MediaMgmt() {", "export function MediaMgmt() {\n  const [search, setSearch] = React.useState('');")
        content = content.replace("export function MediaAdOrderMgmt() {", "export function MediaAdOrderMgmt() {\n  const [search, setSearch] = React.useState('');")
        content = content.replace("export function MediaIdMgmt() {", "export function MediaIdMgmt() {\n  const [search, setSearch] = React.useState('');")

    # Replace input with bound search
    content = content.replace("<input className=\"search-input\" placeholder={t('search')} />", "<input className=\"search-input\" placeholder={t('search')} value={search} onChange={e => setSearch(e.target.value)} />")

    # Update Table props for Search: data={db...} -> data={db...filter(...)}
    content = re.sub(r'data=\{db\.advertisers\}', 'data={db.advertisers.filter(x => x.name.includes(search) || x.contact.includes(search))}\n          onEdit={(row) => { openModal(\'newAdvertiser\'); (window as any).editData = row; }}', content)
    content = re.sub(r'data=\{db\.adOrders\}', 'data={db.adOrders.filter(x => x.name.includes(search))}\n          onEdit={(row) => { openModal(\'newAdOrder\'); (window as any).editData = row; }}', content)
    content = re.sub(r'data=\{db\.adIds\}', 'data={db.adIds.filter(x => x.slot.includes(search))}\n          onEdit={(row) => { openModal(\'newAdId\'); (window as any).editData = row; }}', content)

    content = re.sub(r'data=\{db\.medias\}', 'data={db.medias.filter(x => x.name.includes(search) || x.contact.includes(search))}\n          onEdit={(row) => { openModal(\'newMedia\'); (window as any).editData = row; }}', content)
    content = re.sub(r'data=\{db\.mediaAdOrders\}', 'data={db.mediaAdOrders.filter(x => x.name.includes(search))}\n          onEdit={(row) => { openModal(\'newMediaAdOrder\'); (window as any).editData = row; }}', content)
    content = re.sub(r'data=\{db\.mediaIds\}', 'data={db.mediaIds.filter(x => x.slot.includes(search))}\n          onEdit={(row) => { openModal(\'newMediaId\'); (window as any).editData = row; }}', content)

    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

fix_file("src/pages/Advertiser.tsx")
try:
    fix_file("src/pages/Media.tsx")
except Exception:
    pass
