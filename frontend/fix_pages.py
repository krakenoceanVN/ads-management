import re
import os

with open("src/pages/Advertiser.tsx", "r", encoding="utf-8") as f:
    text = f.read()

text = text.replace("{ key: '__actions__', label: t('actions') }", "{ key: 'status', label: t('status'), render: (r: any) => <StatusToggle status={r.status !== false} /> },\n            { key: '__actions__', label: t('actions') }")

with open("src/pages/Advertiser.tsx", "w", encoding="utf-8") as f:
    f.write(text)

if os.path.exists("src/pages/Media.tsx"):
    with open("src/pages/Media.tsx", "r", encoding="utf-8") as f:
        text2 = f.read()
    if "StatusToggle" not in text2:
        text2 = "import { StatusToggle } from './Advertiser';\n" + text2
        text2 = text2.replace("{ key: '__actions__', label: t('actions') }", "{ key: 'status', label: t('status'), render: (r: any) => <StatusToggle status={r.status !== false} /> },\n            { key: '__actions__', label: t('actions') }")
        with open("src/pages/Media.tsx", "w", encoding="utf-8") as f:
            f.write(text2)
