UPDATE autorisations_parentales SET
  taille = CASE eleve_nom
    WHEN 'Bernard' THEN 165 WHEN 'Dubois' THEN 158 WHEN 'Moreau' THEN 172
    WHEN 'Simon' THEN 155 WHEN 'Laurent' THEN 168 WHEN 'Lefebvre' THEN 160
    WHEN 'Garcia' THEN 170 WHEN 'Roux' THEN 162 WHEN 'Fournier' THEN 175
    WHEN 'Girard' THEN 157 WHEN 'Andre' THEN 169 WHEN 'Leroy' THEN 163
    WHEN 'Blanc' THEN 171 WHEN 'Guerin' THEN 156 WHEN 'Bonnet' THEN 167
    WHEN 'Dupont' THEN 161 WHEN 'Meyer' THEN 173 WHEN 'Colin' THEN 159
    WHEN 'Morin' THEN 166 WHEN 'Rousseau' THEN 154 WHEN 'Vincent' THEN 174
    WHEN 'Fontaine' THEN 160 ELSE 162
  END,
  poids = CASE eleve_nom
    WHEN 'Bernard' THEN 55 WHEN 'Dubois' THEN 48 WHEN 'Moreau' THEN 62
    WHEN 'Simon' THEN 45 WHEN 'Laurent' THEN 58 WHEN 'Lefebvre' THEN 50
    WHEN 'Garcia' THEN 60 WHEN 'Roux' THEN 52 WHEN 'Fournier' THEN 65
    WHEN 'Girard' THEN 47 WHEN 'Andre' THEN 59 WHEN 'Leroy' THEN 53
    WHEN 'Blanc' THEN 61 WHEN 'Guerin' THEN 46 WHEN 'Bonnet' THEN 57
    WHEN 'Dupont' THEN 51 WHEN 'Meyer' THEN 63 WHEN 'Colin' THEN 49
    WHEN 'Morin' THEN 56 WHEN 'Rousseau' THEN 44 WHEN 'Vincent' THEN 64
    WHEN 'Fontaine' THEN 50 ELSE 54
  END,
  pointure = CASE eleve_nom
    WHEN 'Bernard' THEN 38 WHEN 'Dubois' THEN 36 WHEN 'Moreau' THEN 40
    WHEN 'Simon' THEN 35 WHEN 'Laurent' THEN 39 WHEN 'Lefebvre' THEN 37
    WHEN 'Garcia' THEN 40 WHEN 'Roux' THEN 37 WHEN 'Fournier' THEN 41
    WHEN 'Girard' THEN 36 WHEN 'Andre' THEN 39 WHEN 'Leroy' THEN 38
    WHEN 'Blanc' THEN 40 WHEN 'Guerin' THEN 35 WHEN 'Bonnet' THEN 38
    WHEN 'Dupont' THEN 37 WHEN 'Meyer' THEN 41 WHEN 'Colin' THEN 36
    WHEN 'Morin' THEN 39 WHEN 'Rousseau' THEN 34 WHEN 'Vincent' THEN 41
    WHEN 'Fontaine' THEN 37 ELSE 38
  END,
  regime_alimentaire = CASE eleve_nom
    WHEN 'Garcia' THEN 'Sans gluten'
    WHEN 'Roux' THEN 'Sans lactose'
    WHEN 'Fournier' THEN 'Sans arachides'
    ELSE NULL
  END
WHERE sejour_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
