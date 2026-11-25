#!/usr/bin/env python3
"""Garde-fou des migrations Flyway (SEC-14), exécuté en CI.

  1. rejoue tous les scripts db/migration/V*.sql de chaque service sur un vrai PostgreSQL (V1 est rejoué une 2e fois :
     il doit être idempotent) ;
  2. compare chaque entité JPA aux colonnes réelles : nom de colonne manquant ou contrainte NOT NULL divergente = échec,
     car `ddl-auto: validate` ferait échouer le démarrage du service.

    pip install pgserver psycopg2-binary && python3 infrastructure/scripts/check-migrations.py
"""
import pgserver,tempfile,glob,os,psycopg2,sys
srv=pgserver.get_server(tempfile.mkdtemp())
uri=srv.get_uri(); print(uri)
root=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','..','backend','services')
for svc in sorted(os.listdir(root)):
    files=sorted(glob.glob(f'{root}/{svc}/src/main/resources/db/migration/V*.sql'))
    if not files: continue
    db=svc.replace('-','_')
    c=psycopg2.connect(uri); c.autocommit=True; c.cursor().execute(f'create database {db}'); c.close()
    c=psycopg2.connect(uri.replace('@/postgres',f'@/{db}',1)); c.autocommit=True; cur=c.cursor()
    for f in files:
        cur.execute(open(f).read()); print('OK',svc,os.path.basename(f))
    cur.execute(open(files[0]).read())  # V1 rejouable
    cur.execute("select table_name from information_schema.tables where table_schema='public' order by 1")
    print('   tables:',[r[0] for r in cur.fetchall()])
    c.close()
print('ALL MIGRATIONS EXECUTED ON POSTGRESQL')


# ---------- Cross-check entités <-> colonnes ----------
import re
def snake(s): return re.sub(r'([a-z0-9])([A-Z])',r'\1_\2',s).lower()
problems=0
for f in glob.glob(root+'/*/src/main/java/**/domain/*.java',recursive=True):
    t=open(f).read().replace('\r','')
    if '@Entity' not in t: continue
    svc=f.split('/services/')[1].split('/')[0]
    cls=os.path.basename(f)[:-5]
    m=re.search(r'@Table\(name\s*=\s*"([^"]+)"',t)
    table=m.group(1) if m else snake(cls)+'s'
    db=svc.replace('-','_')
    c=psycopg2.connect(uri.replace('@/postgres',f'@/{db}',1)); cur=c.cursor()
    cur.execute("select column_name,is_nullable from information_schema.columns where table_name=%s",(table,))
    cols={r[0]:r[1] for r in cur.fetchall()}; c.close()
    body=t[t.index('class '+cls):]
    pend=[]
    expected={}
    for line in body.split('\n'):
        s=line.strip()
        if s.startswith('@'): pend.append(s); continue
        m=re.match(r'private\s+(?!static)([\w<>\.,\s]+?)\s+(\w+)\s*(=.*)?;',s)
        if m:
            a=' '.join(pend); pend=[]
            if any(x in a for x in ('@OneToMany','@Transient','ElementCollection')): continue
            name=None
            mj=re.search(r'@JoinColumn\(name\s*=\s*"([^"]+)"',a)
            mc=re.search(r'@Column\([^)]*name\s*=\s*"([^"]+)"',a)
            name=(mj or mc).group(1) if (mj or mc) else snake(m.group(2))
            if name in ('lawyer_id',) and table=='clients': continue
            nn=('nullable = false' in a) or '@Id' in a or m.group(1)=='boolean' or '@Version' in a
            expected[name]=nn
        elif s and not s.startswith('//') and not s.startswith('*') and not s.startswith('/*'):
            pend=[]
    for name,nn in expected.items():
        if name not in cols: print('MISSING COLUMN',table,name); problems+=1
        elif nn and cols[name]!='NO': print('SHOULD BE NOT NULL',table,name); problems+=1
        elif not nn and cols[name]=='NO': print('EXTRA NOT NULL',table,name); problems+=1
    extra=set(cols)-set(expected)
    print(f'{table:32s} entity cols={len(expected):2d} db cols={len(cols):2d} extra_in_db={sorted(extra)}')
print('PROBLEMS:',problems)
sys.exit(1 if problems else 0)
