# Bhulekh Desperate Probe Results
Generated: 2026-04-17T20:00:35.200Z

## THE WORKING APPROACH

**The AJAX POST with the correct form data (including csrfval) produces
pageRedirect: /SRoRFront_Uni.aspx**

### The exact working sequence:

1. GET /RoRView.aspx → click "here" → /RoRView.aspx (public session)
2. selectOption ddlDistrict = "20"
3. selectOption ddlTahsil = "2"
4. selectOption ddlVillage = "105"
5. wait for radio buttons to be enabled
6. click rbtnRORSearchtype_1 (Plot mode)
7. selectOption ddlBindData = "128                           " (trailing spaces preserved)
8. Read ALL form data via FormData (includes csrfval)
9. POST to /RoRView.aspx with:
   - __EVENTTARGET = "ctl00$ContentPlaceHolder1$btnRORFront"
   - __EVENTARGUMENT = ""
   - ctl00$ScriptManager1 = "ctl00$ContentPlaceHolder1$UpdatePanel1|ctl00$ContentPlaceHolder1$btnRORFront"
   - ctl00$ContentPlaceHolder1$btnRORFront = "View RoR"
   - ctl00$csrfval = [current csrfval from form]
   - ctl00$ContentPlaceHolder1$ddlBindData = "128                           "
   - All other form fields (VIEWSTATE, EVENTVALIDATION, etc.)
   - Headers: x-microsoftajax: Delta=true, x-requested-with: XMLHttpRequest
10. Response is delta format: "pageRedirect||/SRoRFront_Uni.aspx"
11. Navigate to the redirect URL

## Verified Values

- District 20 = ଖୋର୍ଦ୍ଧା (Khordha)
- Tahasil 2 = ଭୁବନେଶ୍ଵର (Bhubaneswar)
- Village 105 = ମେଣ୍ଢାଶାଳ (Mendhasala)
- Plot 128: value = "128                           " (26 trailing spaces)

## Tahasil enumeration (district 20)

[
  {
    "code": "1",
    "name": "ବାଣପୁର"
  },
  {
    "code": "2",
    "name": "ଭୁବନେଶ୍ଵର"
  },
  {
    "code": "3",
    "name": "ଖୋର୍ଦ୍ଧା"
  },
  {
    "code": "4",
    "name": "ବେଗୁନିଆ"
  },
  {
    "code": "5",
    "name": "ବୋଲଗଡ"
  },
  {
    "code": "6",
    "name": "ଜଟଣୀ"
  },
  {
    "code": "7",
    "name": "ଟାଙ୍ଗି"
  },
  {
    "code": "8",
    "name": "ବାଲିଅନ୍ତା"
  },
  {
    "code": "9",
    "name": "ବାଲି ପାଟଣା"
  },
  {
    "code": "10",
    "name": "ଚିଲିକା"
  }
]

## Mendhasala village details

- Village code: 105
- Odia name: ମେଣ୍ଢାଶାଳ
- Tahasil: 2 (Bhubaneswar)
- District: 20 (Khordha)
- Khatiyan count: 4427 (excluding "Select")
- Plot count: 4427 (excluding "Select")

## SRoR Page Result

Final URL: https://bhulekh.ori.nic.in/SRoRFront_Uni.aspx
Page text:
Schedule I Form No.39-A
ଖତିୟାନ


ମୌଜା : ମେଣ୍ଢାଶାଳ	ତହସିଲ : ଭୁବନେଶ୍ଵର
ଥାନା : ଚନ୍ଦକା	ତହସିଲ ନମ୍ବର : ..
ଥାନା ନମ୍ବର : 22	ଜିଲ୍ଲା : ଖୋର୍ଦ୍ଧା
ଜମିଦାରଙ୍କ ନାମ ଓ ଖେୱାଟ ବା ଖତିୟାନର କ୍ରମିକ ନମ୍ବର	
ଓଡିଶା ସରକାର ଖେୱାଟ ନମ୍ବର 1

1) ଖତିୟାନର କ୍ରମିକ ନମ୍ବର	
128

2) ପ୍ରଜାର ନାମ, ପିତାର ନାମ, ଜାତି ଓ ବାସସ୍ଥାନ	
ଗଫୁରନ ବିବି ସ୍ଵା:ସେକ୍ ରହେମାନ ଜା: ମୁସଲମାନ ବା: ନିଜିଗାଁ
3) ସ୍ଵତ୍ଵ	
ସ୍ଥିତିବାନ

4) ଦେୟ :	
ଜଳକର	ଖଜଣା	ସେସ୍	ନିସ୍ତାର ସେସ୍ ଓ ଅନ୍ୟାନ୍ୟ ସେସ୍ ଯଦି କିଛି ଥାଏ	ମୋଟ	
5) କ୍ରମବର୍ଦ୍ଧନଶୀଳ ଖଜଣାର ବିବରଣି


	2.00	1.50	0.06	3.56	
6) ବିଶେଷ ଅନୁସଙ୍ଗ ଯଦି କିଛି ଥାଏ	
ସ୍ଵତ୍ଵଲିପି ପ୍ରସ୍ତୁତି ହେଇଥିବା ସମୟରେ ପ୍ରଚଳିତ କ. ଖଜଣା ଏକ ଟଙ୍କା ଏଗାର ଅଣା, ଖ. ଜଳକର -------, ଗ. ସେସ୍ ଏକ ଅଣା ଛଅ ପାହି , ଘ. ନିସ୍ତାର ସେସ୍ ନଅ ପାହି ।
BLANK SPACE FOR STAMPING
ଅନ୍ତିମ ପ୍ରକାଶନ ତାରିଖ - 06/03/1962
ଖଜଣା ଧାର୍ଯ୍ୟ ତାରିଖ -

 

		
ଖତିୟାନର କ୍ରମିକ ନଂ : 128	ମୌଜା : ମେଣ୍ଢାଶାଳ	ଜିଲ୍ଲା : ଖୋର୍ଦ୍ଧା
ପ୍ଲଟ ନମ୍ବର ଓ ଚକର ନାମ	କିସମ ଓ ପ୍ଲଟର ଖଜଣା	କିସମର ବିସ୍ତାରିତ ବିବରଣୀ ଓ ଚୌହଦି	ରକବା	ମନ୍ତବ୍ୟ
ଏ.	ଡି.	ହେକ୍ଟର
7	8	9	1	0	11	12
2063
	ଶାରଦ ତିନି	

	0	2200	0.0890	
1 plot			0	2200	0.0890	


ରାଷ୍ଟ୍ରୀୟ ସୂଚନା ବିଜ୍ଞାନ କେନ୍ଦ୍ର 18/04/2026 01:29:52 IP :223.181.33.111

  

---

## Full Log

Starting Bhulekh RoR Fetch — THE WORKING APPROACH
Time: 2026-04-17T20:00:21.160Z

=== STEP 1: Bootstrap public session ===

Clicking 'here'...
Landed at: /RoRView.aspx

=== STEP 2: Select district 20 (Khordha) ===

District 20 selected

=== STEP 3: Select tahasil 2 (Bhubaneswar) ===

Tahasils: [Select Tahasil] "Select Tahasil", [3] "ଖୋର୍ଦ୍ଧା", [10] "ଚିଲିକା", [6] "ଜଟଣୀ", [7] "ଟାଙ୍ଗି", [1] "ବାଣପୁର", [8] "ବାଲିଅନ୍ତା", [9] "ବାଲି ପାଟଣା", [4] "ବେଗୁନିଆ", [5] "ବୋଲଗଡ", [2] "ଭୁବନେଶ୍ଵର"
Tahasil 2 selected

=== STEP 4: Select village 105 (Mendhasala) ===

Villages: 185 total
Mendhasala matches: [105] "ମେଣ୍ଢାଶାଳ"
Village 105 (Mendhasala) selected

=== STEP 5: Switch to Plot mode ===

Switched to Plot mode

=== STEP 6: Select plot 128 ===

Plot options: 4428
Plot 128 value: "128                           "
btnRORFront: visible=true, value="View RoR"

=== STEP 7: THE KEY POST — View RoR with csrfval ===

Form keys: ctl00$txtSearchBox, ctl00$ContentPlaceHolder1$csrfval, ctl00$ContentPlaceHolder1$ddlDistrict, ctl00$ContentPlaceHolder1$rbtnRORSearchtype, ctl00$ContentPlaceHolder1$ddlTahsil, ctl00$ContentPlaceHolder1$ddlBindData, ctl00$ContentPlaceHolder1$hidredirectsts, ctl00$ContentPlaceHolder1$ddlVillage, ctl00$txtUserName, ctl00$txtOldPassword, ctl00$txtNewPassword, ctl00$txtConfirmPassword, __EVENTTARGET, __EVENTARGUMENT, __LASTFOCUS, __VIEWSTATE, __VIEWSTATEGENERATOR, __EVENTVALIDATION
ddlBindData in form: "128                           "
csrfval: undefined...
Sending AJAX POST with btnRORFront event...
Status: 200
Body length: 46 chars
Body: 1|#||4|21|pageRedirect||%2fSRoRFront_Uni.aspx|
pageRedirect: /SRoRFront_Uni.aspx
SUCCESS! Redirecting to: /SRoRFront_Uni.aspx

=== STEP 8: Navigate to SRoR page ===

Navigating to: /SRoRFront_Uni.aspx
Final URL: /SRoRFront_Uni.aspx
SRoR page saved to /tmp/bhulekh-sror-page.html

=== STEP 9: Parse SRoR page ===

Page title: .:BHULEKH || ODISHA:.
Page text (first 2000 chars):
Schedule I Form No.39-A
ଖତିୟାନ


ମୌଜା : ମେଣ୍ଢାଶାଳ	ତହସିଲ : ଭୁବନେଶ୍ଵର
ଥାନା : ଚନ୍ଦକା	ତହସିଲ ନମ୍ବର : ..
ଥାନା ନମ୍ବର : 22	ଜିଲ୍ଲା : ଖୋର୍ଦ୍ଧା
ଜମିଦାରଙ୍କ ନାମ ଓ ଖେୱାଟ ବା ଖତିୟାନର କ୍ରମିକ ନମ୍ବର	
ଓଡିଶା ସରକାର ଖେୱାଟ ନମ୍ବର 1

1) ଖତିୟାନର କ୍ରମିକ ନମ୍ବର	
128

2) ପ୍ରଜାର ନାମ, ପିତାର ନାମ, ଜାତି ଓ ବାସସ୍ଥାନ	
ଗଫୁରନ ବିବି ସ୍ଵା:ସେକ୍ ରହେମାନ ଜା: ମୁସଲମାନ ବା: ନିଜିଗାଁ
3) ସ୍ଵତ୍ଵ	
ସ୍ଥିତିବାନ

4) ଦେୟ :	
ଜଳକର	ଖଜଣା	ସେସ୍	ନିସ୍ତାର ସେସ୍ ଓ ଅନ୍ୟାନ୍ୟ ସେସ୍ ଯଦି କିଛି ଥାଏ	ମୋଟ	
5) କ୍ରମବର୍ଦ୍ଧନଶୀଳ ଖଜଣାର ବିବରଣି


	2.00	1.50	0.06	3.56	
6) ବିଶେଷ ଅନୁସଙ୍ଗ ଯଦି କିଛି ଥାଏ	
ସ୍ଵତ୍ଵଲିପି ପ୍ରସ୍ତୁତି ହେଇଥିବା ସମୟରେ ପ୍ରଚଳିତ କ. ଖଜଣା ଏକ ଟଙ୍କା ଏଗାର ଅଣା, ଖ. ଜଳକର -------, ଗ. ସେସ୍ ଏକ ଅଣା ଛଅ ପାହି , ଘ. ନିସ୍ତାର ସେସ୍ ନଅ ପାହି ।
BLANK SPACE FOR STAMPING
ଅନ୍ତିମ ପ୍ରକାଶନ ତାରିଖ - 06/03/1962
ଖଜଣା ଧାର୍ଯ୍ୟ ତାରିଖ -

 

		
ଖତିୟାନର କ୍ରମିକ ନଂ : 128	ମୌଜା : ମେଣ୍ଢାଶାଳ	ଜିଲ୍ଲା : ଖୋର୍ଦ୍ଧା
ପ୍ଲଟ ନମ୍ବର ଓ ଚକର ନାମ	କିସମ ଓ ପ୍ଲଟର ଖଜଣା	କିସମର ବିସ୍ତାରିତ ବିବରଣୀ ଓ ଚୌହଦି	ରକବା	ମନ୍ତବ୍ୟ
ଏ.	ଡି.	ହେକ୍ଟର
7	8	9	1	0	11	12
2063
	ଶାରଦ ତିନି	

	0	2200	0.0890	
1 plot			0	2200	0.0890	


ରାଷ୍ଟ୍ରୀୟ ସୂଚନା ବିଜ୍ଞାନ କେନ୍ଦ୍ର 18/04/2026 01:29:52 IP :223.181.33.111

  
Tables found: 17
Table 0: 23 rows, headers: Schedule I Form No.39-A
                                            
                                            
                                                ଖତିୟାନ
                                            
                                            
                                            
                                                
                                                    
                                                        ମୌଜା :
                                                        ମେଣ୍ଢାଶାଳ
                                                        
                                                        ତହସିଲ :
                                                        ଭୁବନେଶ୍ଵର
                                                        
                                                    
                                                    
                                                        ଥାନା :
                                                        ଚନ୍ଦକା
                                                        
                                                        ତହସିଲ ନମ୍ବର :
                                                        ..
                                                        
                                                    
                                                    
                                                        ଥାନା ନମ୍ବର :
                                                        22
                                                        
                                                        ଜିଲ୍ଲା :
                                                        ଖୋର୍ଦ୍ଧା
                                                        
                                                    
                                                
                                            
                                            
                                                
                                                    ଜମିଦାରଙ୍କ ନାମ ଓ ଖେୱାଟ ବା ଖତିୟାନର କ୍ରମିକ ନମ୍ବର
                                                    
                                                    
                                                        
                                                            
                                                                
                                                                    ଓଡିଶା ସରକାର ଖେୱାଟ ନମ୍ବର 1
                                                                
                                                            
                                                        
                                                    
                                                
                                                
                                                    1) ଖତିୟାନର କ୍ରମିକ ନମ୍ବର
                                                    
                                                    
                                                        
                                                            
                                                                
                                                                    128
                                                                
                                                            
                                                        
                                                    
                                                
                                                
                                                    2) ପ୍ରଜାର ନାମ, ପିତାର ନାମ, ଜାତି ଓ ବାସସ୍ଥାନ
                                                    
                                                    
                                                        
                                                            
                                                                
                                                                    ଗଫୁରନ ବିବି ସ୍ଵା:ସେକ୍ ରହେମାନ ଜା: ମୁସଲମାନ ବା: ନିଜିଗାଁ
                                                                
                                                            
                                                        
                                                    
                                                
                                            
                                            
                                            
                                                
                                                    3) ସ୍ଵତ୍ଵ
                                                    
                                                    
                                                        
                                                            
                                                                
                                                                    ସ୍ଥିତିବାନ
                                                                
                                                            
                                                        
                                                    
                                                
                                                
                                                    4) ଦେୟ :
                                                    
                                                    
                                                        
                                                            
                                                                
                                                                    
                                                                    ଜଳକର
                                                                    
                                                                
                                                                
                                                                    
                                                                    ଖଜଣା
                                                                    
                                                                
                                                                
                                                                    
                                                                    ସେସ୍
                                                                    
                                                                
                                                                
                                                                    
                                                                    ନିସ୍ତାର ସେସ୍ ଓ ଅନ୍ୟାନ୍ୟ ସେସ୍ ଯଦି କିଛି ଥାଏ
                                                                    
                                                                
                                                                
                                                                    
                                                                    ମୋଟ
                                                                    
                                                                
                                                                
                                                                    
                                                                        
                                                                            5) କ୍ରମବର୍ଦ୍ଧନଶୀଳ ଖଜଣାର ବିବରଣି
                                                                            

                                                                        
                                                                    
                                                                
                                                            
                                                            
                                                                

                                                                      
                                                                    
                                                                    
                                                                  
                                                                
                                                                
                                                                    2.00
                                                                
                                                                
                                                                    1.50
                                                                
                                                                
                                                                    0.06
                                                                
                                                                
                                                                    3.56
                                                                
                                                                
                                                                    
                                                                        
                                                                            
                                                                                
                                                                            
                                                                        
                                                                    
                                                                
                                                            
                                                        
                                                    
                                                
                                            
                                            
                                                
                                                    6) ବିଶେଷ ଅନୁସଙ୍ଗ ଯଦି କିଛି ଥାଏ
                                                    
                                                    
                                                        
                                                            
                                                                
                                                                    ସ୍ଵତ୍ଵଲିପି ପ୍ରସ୍ତୁତି ହେଇଥିବା ସମୟରେ ପ୍ରଚଳିତ କ. ଖଜଣା ଏକ ଟଙ୍କା ଏଗାର ଅଣା, ଖ. ଜଳକର -------, ଗ. ସେସ୍ ଏକ ଅଣା ଛଅ ପାହି , ଘ. ନିସ୍ତାର ସେସ୍ ନଅ ପାହି ।
                                                                
                                                            
                                                        
                                                    
                                                
                                            
                                            
                                                
                                                    BLANK SPACE FOR STAMPING
                                                    
                                                
                                                
                                                    ଅନ୍ତିମ ପ୍ରକାଶନ ତାରିଖ -
                                                        06/03/1962
                                                    
                                                
                                                
                                                    ଖଜଣା ଧାର୍ଯ୍ୟ ତାରିଖ -, ମୌଜା :
                                                        ମେଣ୍ଢାଶାଳ, ତହସିଲ :
                                                        ଭୁବନେଶ୍ଵର, ଥାନା :
                                                        ଚନ୍ଦକା, ତହସିଲ ନମ୍ବର :
                                                        .., ଥାନା ନମ୍ବର :
                                                        22, ଜିଲ୍ଲା :
                                                        ଖୋର୍ଦ୍ଧା, ଜମିଦାରଙ୍କ ନାମ ଓ ଖେୱାଟ ବା ଖତିୟାନର କ୍ରମିକ ନମ୍ବର, ଓଡିଶା ସରକାର ଖେୱାଟ ନମ୍ବର 1, ଓଡିଶା ସରକାର ଖେୱାଟ ନମ୍ବର 1, 1) ଖତିୟାନର କ୍ରମିକ ନମ୍ବର, 128, 128, 2) ପ୍ରଜାର ନାମ, ପିତାର ନାମ, ଜାତି ଓ ବାସସ୍ଥାନ, ଗଫୁରନ ବିବି ସ୍ଵା:ସେକ୍ ରହେମାନ ଜା: ମୁସଲମାନ ବା: ନିଜିଗାଁ, ଗଫୁରନ ବିବି ସ୍ଵା:ସେକ୍ ରହେମାନ ଜା: ମୁସଲମାନ ବା: ନିଜିଗାଁ, 3) ସ୍ଵତ୍ଵ, ସ୍ଥିତିବାନ, ସ୍ଥିତିବାନ, 4) ଦେୟ :, ଜଳକର
                                                                    
                                                                
                                                                
                                                                    
                                                                    ଖଜଣା
                                                                    
                                                                
                                                                
                                                                    
                                                                    ସେସ୍
                                                                    
                                                                
                                                                
                                                                    
                                                                    ନିସ୍ତାର ସେସ୍ ଓ ଅନ୍ୟାନ୍ୟ ସେସ୍ ଯଦି କିଛି ଥାଏ
                                                                    
                                                                
                                                                
                                                                    
                                                                    ମୋଟ
                                                                    
                                                                
                                                                
                                                                    
                                                                        
                                                                            5) କ୍ରମବର୍ଦ୍ଧନଶୀଳ ଖଜଣାର ବିବରଣି
                                                                            

                                                                        
                                                                    
                                                                
                                                            
                                                            
                                                                

                                                                      
                                                                    
                                                                    
                                                                  
                                                                
                                                                
                                                                    2.00
                                                                
                                                                
                                                                    1.50
                                                                
                                                                
                                                                    0.06
                                                                
                                                                
                                                                    3.56, ଜଳକର, ଖଜଣା, ସେସ୍, ନିସ୍ତାର ସେସ୍ ଓ ଅନ୍ୟାନ୍ୟ ସେସ୍ ଯଦି କିଛି ଥାଏ, ମୋଟ, 5) କ୍ରମବର୍ଦ୍ଧନଶୀଳ ଖଜଣାର ବିବରଣି, 5) କ୍ରମବର୍ଦ୍ଧନଶୀଳ ଖଜଣାର ବିବରଣି, 2.00, 1.50, 0.06, 3.56, 6) ବିଶେଷ ଅନୁସଙ୍ଗ ଯଦି କିଛି ଥାଏ, ସ୍ଵତ୍ଵଲିପି ପ୍ରସ୍ତୁତି ହେଇଥିବା ସମୟରେ ପ୍ରଚଳିତ କ. ଖଜଣା ଏକ ଟଙ୍କା ଏଗାର ଅଣା, ଖ. ଜଳକର -------, ଗ. ସେସ୍ ଏକ ଅଣା ଛଅ ପାହି , ଘ. ନିସ୍ତାର ସେସ୍ ନଅ ପାହି ।, ସ୍ଵତ୍ଵଲିପି ପ୍ରସ୍ତୁତି ହେଇଥିବା ସମୟରେ ପ୍ରଚଳିତ କ. ଖଜଣା ଏକ ଟଙ୍କା ଏଗାର ଅଣା, ଖ. ଜଳକର -------, ଗ. ସେସ୍ ଏକ ଅଣା ଛଅ ପାହି , ଘ. ନିସ୍ତାର ସେସ୍ ନଅ ପାହି ।, BLANK SPACE FOR STAMPING, ଅନ୍ତିମ ପ୍ରକାଶନ ତାରିଖ -
                                                        06/03/1962, ଖଜଣା ଧାର୍ଯ୍ୟ ତାରିଖ -
  First row: ମୌଜା :
                                                        ମେଣ୍ଢାଶାଳ | ତହସିଲ :
                                                        ଭୁବନେଶ୍ଵର
Table 1: 3 rows, headers: ମୌଜା :
                                                        ମେଣ୍ଢାଶାଳ, ତହସିଲ :
                                                        ଭୁବନେଶ୍ଵର
  First row: ଥାନା :
                                                        ଚନ୍ଦକା | ତହସିଲ ନମ୍ବର :
                                                        ..
Table 2: 6 rows, headers: ଜମିଦାରଙ୍କ ନାମ ଓ ଖେୱାଟ ବା ଖତିୟାନର କ୍ରମିକ ନମ୍ବର, ଓଡିଶା ସରକାର ଖେୱାଟ ନମ୍ବର 1, ଓଡିଶା ସରକାର ଖେୱାଟ ନମ୍ବର 1
  First row: ଓଡିଶା ସରକାର ଖେୱାଟ ନମ୍ବର 1
Table 3: 1 rows, headers: ଓଡିଶା ସରକାର ଖେୱାଟ ନମ୍ବର 1
Table 4: 1 rows, headers: 128
Table 5: 1 rows, headers: ଗଫୁରନ ବିବି ସ୍ଵା:ସେକ୍ ରହେମାନ ଜା: ମୁସଲମାନ ବା: ନିଜିଗାଁ
Table 6: 7 rows, headers: 3) ସ୍ଵତ୍ଵ, ସ୍ଥିତିବାନ, ସ୍ଥିତିବାନ
  First row: ସ୍ଥିତିବାନ
Table 7: 1 rows, headers: ସ୍ଥିତିବାନ
Table 8: 4 rows, headers: ଜଳକର, ଖଜଣା, ସେସ୍, ନିସ୍ତାର ସେସ୍ ଓ ଅନ୍ୟାନ୍ୟ ସେସ୍ ଯଦି କିଛି ଥାଏ, ମୋଟ, 5) କ୍ରମବର୍ଦ୍ଧନଶୀଳ ଖଜଣାର ବିବରଣି, 5) କ୍ରମବର୍ଦ୍ଧନଶୀଳ ଖଜଣାର ବିବରଣି
  First row: 5) କ୍ରମବର୍ଦ୍ଧନଶୀଳ ଖଜଣାର ବିବରଣି
Table 9: 1 rows, headers: 5) କ୍ରମବର୍ଦ୍ଧନଶୀଳ ଖଜଣାର ବିବରଣି
Table 10: 1 rows, headers: 
Table 11: 2 rows, headers: 6) ବିଶେଷ ଅନୁସଙ୍ଗ ଯଦି କିଛି ଥାଏ, ସ୍ଵତ୍ଵଲିପି ପ୍ରସ୍ତୁତି ହେଇଥିବା ସମୟରେ ପ୍ରଚଳିତ କ. ଖଜଣା ଏକ ଟଙ୍କା ଏଗାର ଅଣା, ଖ. ଜଳକର -------, ଗ. ସେସ୍ ଏକ ଅଣା ଛଅ ପାହି , ଘ. ନିସ୍ତାର ସେସ୍ ନଅ ପାହି ।, ସ୍ଵତ୍ଵଲିପି ପ୍ରସ୍ତୁତି ହେଇଥିବା ସମୟରେ ପ୍ରଚଳିତ କ. ଖଜଣା ଏକ ଟଙ୍କା ଏଗାର ଅଣା, ଖ. ଜଳକର -------, ଗ. ସେସ୍ ଏକ ଅଣା ଛଅ ପାହି , ଘ. ନିସ୍ତାର ସେସ୍ ନଅ ପାହି ।
  First row: ସ୍ଵତ୍ଵଲିପି ପ୍ରସ୍ତୁତି ହେଇଥିବା ସମୟରେ ପ୍ରଚଳିତ କ. ଖଜଣା ଏକ ଟଙ୍କା ଏଗାର ଅଣା, ଖ. ଜଳକର -------, ଗ. ସେସ୍ ଏକ ଅଣା ଛଅ ପାହି , ଘ. ନିସ୍ତାର ସେସ୍ ନଅ ପାହି ।
Table 12: 1 rows, headers: ସ୍ଵତ୍ଵଲିପି ପ୍ରସ୍ତୁତି ହେଇଥିବା ସମୟରେ ପ୍ରଚଳିତ କ. ଖଜଣା ଏକ ଟଙ୍କା ଏଗାର ଅଣା, ଖ. ଜଳକର -------, ଗ. ସେସ୍ ଏକ ଅଣା ଛଅ ପାହି , ଘ. ନିସ୍ତାର ସେସ୍ ନଅ ପାହି ।
Table 13: 3 rows, headers: BLANK SPACE FOR STAMPING
  First row: ଅନ୍ତିମ ପ୍ରକାଶନ ତାରିଖ -
                                                        06/03/1962
Table 14: 1 rows, headers: 
Table 15: 6 rows, headers: ଖତିୟାନର କ୍ରମିକ ନଂ : 128, ମୌଜା : ମେଣ୍ଢାଶାଳ, ଜିଲ୍ଲା : ଖୋର୍ଦ୍ଧା
  First row: ପ୍ଲଟ ନମ୍ବର ଓ ଚକର ନାମ | କିସମ ଓ ପ୍ଲଟର ଖଜଣା | କିସମର ବିସ୍ତାରିତ ବିବରଣୀ ଓ ଚୌହଦି | ରକବା | ମନ୍ତବ୍ୟ
Table 16: 1 rows, headers: 
Potential owner cells: ["ପ୍ଲଟ ନମ୍ବର ଓ ଚକର ନାମ","କିସମ ଓ ପ୍ଲଟର ଖଜଣା","କିସମର ବିସ୍ତାରିତ ବିବରଣୀ ଓ ଚୌହଦି","ରକବା","1 plot"]

=== SAVING RESULTS ===

