import re

with open("src/components/Table.tsx", "r", encoding="utf-8") as f:
    text = f.read()

text = text.replace("interface TableProps<T> {", "interface TableProps<T> {\n  onEdit?: (row: T) => void;")
text = text.replace("<button className=\"action-btn\" title=\"Edit\">✏️</button>", "<button className=\"action-btn\" title=\"Edit\" onClick={() => onEdit && onEdit(row)}>✏️</button>")
text = text.replace("emptyText = '—' }: TableProps<T>)", "emptyText = '—', onEdit }: TableProps<T>)")

with open("src/components/Table.tsx", "w", encoding="utf-8") as f:
    f.write(text)
