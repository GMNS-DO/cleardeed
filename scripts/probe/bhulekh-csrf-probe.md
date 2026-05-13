# Bhulekh CSRF Probe — ERROR

page.evaluate: ReferenceError: buildUrlEncoded is not defined
    at eval (eval at evaluate (:302:30), <anonymous>:1:23)
    at UtilityScript.evaluate (<anonymous>:304:16)
    at UtilityScript.<anonymous> (<anonymous>:1:44)

Log:
Starting Bhulekh CSRF-Aware Probe
Time: 2026-04-17T19:58:34.358Z

=== STEP 1: Capture CSRF token at each stage ===

CSRF after bootstrap: (not found)...
Hidden inputs: 7
  __EVENTTARGET: ...
  __EVENTARGUMENT: ...
  __VIEWSTATE: BE8vw7gcgaNIh94yOUrwLHXmBXFzBc...
  __VIEWSTATEGENERATOR: ED6F5C4D...
  __EVENTVALIDATION: iZ6CBr3HlncmJXJR4SbI7v4qBScY1E...
  ctl00$ContentPlaceHolder1$csrfval: 457805223311504177986586960494...

=== STEP 2: CSRF after village selection (Mendhasala 105) ===

CSRF after village: (not found)...
CSRF changed: NO

=== STEP 3: CSRF after Plot mode switch ===

CSRF after Plot switch: (not found)...
CSRF changed: NO

=== STEP 4: Full form data capture before plot selection ===

Form keys: 18
  ctl00$ContentPlaceHolder1$csrfval: 12492697241391346272488301370147087799915171457401...
  ctl00$ContentPlaceHolder1$ddlDistrict: 20
  ctl00$ContentPlaceHolder1$rbtnRORSearchtype: Plot
  ctl00$ContentPlaceHolder1$ddlTahsil: 2
  ctl00$ContentPlaceHolder1$ddlVillage: 105
  __EVENTTARGET: ctl00$ContentPlaceHolder1$rbtnRORSearchtype$1
  __EVENTARGUMENT: 
  __VIEWSTATE: m5dHKXueIGu0N7epxUF+VuEBcSDpb38TERmVJbHcoW/gTQTIfm...
  __VIEWSTATEGENERATOR: ED6F5C4D
  __EVENTVALIDATION: hAtbkdatn7ryDTKZciqcJihR+zHFr/xSF/oJKkxtGJvZW3SnHy...
rbtnRORSearchtype: Plot
ddlDistrict: 20
ddlTahsil: 2
ddlVillage: 105

=== STEP 5: Select plot 128 and capture form ===

Plot 128 value: "128                           "
Form ddlBindData after selection: "128                           "
CSRF after plot selection: undefined...
btnRORFront: visible=true, disabled=false, value="View RoR"

=== STEP 6: Approach A — AJAX post with csrfval ===

CSRF in POST: undefined...
ddlBindData in POST: "128                           "
Status: 200
Body length: 46 chars
pageRedirect: /SRoRFront_Uni.aspx
Error: (none)
UpdatePanel: (none)
Hidden fields: 0
SRoR references in response: SRoRFront_Uni

=== STEP 7: Approach B — Full postback with csrfval ===

Sending full postback (non-AJAX)...
ERROR: page.evaluate: ReferenceError: buildUrlEncoded is not defined
    at eval (eval at evaluate (:302:30), <anonymous>:1:23)
    at UtilityScript.evaluate (<anonymous>:304:16)
    at UtilityScript.<anonymous> (<anonymous>:1:44)