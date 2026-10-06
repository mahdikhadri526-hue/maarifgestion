-- Les saisies Café Dubois du calcul des écarts étaient stockées en kg ; le module raisonne désormais en grammes partout. Convertir les valeurs existantes SI/ENTREE/SF du café en grammes (x1000). Les sections VENTE (quantités par article) ne sont pas touchées.
UPDATE public.ecart_lines
SET qty = qty * 1000
WHERE section LIKE 'CAFE:SI\_%'
   OR section LIKE 'CAFE:ENTREE\_%'
   OR section LIKE 'CAFE:SF\_%';