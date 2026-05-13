#!/usr/bin/env bash
# Bhulekh HTTP enumeration — bash+curl only, no browser.
# Since Bhulekh blocks/times out browser automation, we probe via curl.

echo "=== Bhulekh HTTP Probe ==="
echo ""

# Step 1: Get the session cookie and ViewState from RoRView.aspx
echo "Step 1: Fetching RoRView.aspx..."
COOKIES=$(mktemp)
HEADERS_OUT=$(mktemp)

curl -sL \
  -c "$COOKIES" \
  -D "$HEADERS_OUT" \
  -o /dev/null \
  --max-time 30 \
  -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" \
  -H "Accept: text/html,application/xhtml+xml" \
  "https://bhulekh.ori.nic.in/RoRView.aspx"

echo "Status: $(head -1 "$HEADERS_OUT" | grep -o '[0-9][0-9][0-9]')"
echo "Cookies: $(cat "$COOKIES" | grep -v '^#' | grep -v '^$' | wc -l | tr -d ' ') lines"

# Get ViewState from the page
echo ""
echo "Step 2: Parsing ViewState..."
# Using dot format (no dot means no cookie jar for this)
curl -s \
  --max-time 15 \
  -H "User-Agent: Mozilla/5.0" \
  "https://bhulekh.ori.nic.in/RoRView.aspx" > /tmp/bhulekh_ror.html 2>&1

if [ $? -ne 0 ]; then
  echo "FAILED to fetch RoRView.aspx"
  exit 1
fi

echo "Page size: $(wc -c < /tmp/bhulekh_ror.html) bytes"
echo "Has ViewState: $(grep -c '__VIEWSTATE' /tmp/bhulekh_ror.html || echo 0)"

# Extract ViewState and EventValidation
VS=$(grep -oP '__VIEWSTATE\|value="\K[^"]+' /tmp/bhulekh_ror.html | head -1)
EV=$(grep -oP '__EVENTVALIDATION\|value="\K[^"]+' /tmp/bhulekh_ror.html | head -1)
GEN=$(grep -oP '__VIEWSTATEGENERATOR\|value="\K[^"]+' /tmp/bhulekh_ror.html | head -1)

echo "ViewState length: ${#VS}"
echo "EventValidation length: ${#EV}"
echo "ViewStateGenerator: ${GEN:0:20}..."

# Step 3: Check which page we're on (error or main)
if grep -q "BhulekhError" /tmp/bhulekh_ror.html; then
  echo ""
  echo "→ On BhulekhError.aspx (need to click 'here')"
  # Extract the form action URL from the error page
  ERROR_FORM=$(grep -oP 'action="[^"]*"' /tmp/bhulekh_ror.html | head -1)
  echo "  Form action: $ERROR_FORM"

  # Try to post to the error page with the click
  ERROR_URL=$(grep -oP '<form[^>]+action="[^"]*"' /tmp/bhulekh_ror.html | head -1 | grep -oP '"[^"]+"' | tr -d '"')
  if [ -n "$ERROR_URL" ]; then
    echo "  Posting to: $ERROR_URL"
    curl -sL \
      -b "$COOKIES" \
      -c "$COOKIES" \
      -d "btnHere=Click+Here" \
      --max-time 15 \
      -H "User-Agent: Mozilla/5.0" \
      "$ERROR_URL" > /tmp/bhulekh_after_click.html 2>&1
    echo "After-click size: $(wc -c < /tmp/bhulekh_after_click.html) bytes"
    grep -q "ddlDistrict" /tmp/bhulekh_after_click.html && echo "→ Got district dropdown!" || echo "→ Still no district dropdown"
  fi
elif grep -q "ddlDistrict" /tmp/bhulekh_ror.html; then
  echo ""
  echo "→ Already on main RoRView.aspx with district dropdown"
else
  echo ""
  echo "→ Unknown page state"
fi

# Step 4: Check the other pages (Index.aspx, SearchYourPlot.aspx)
echo ""
echo "=== Other Bhulekh Pages ==="

for PAGE in "Index.aspx" "SearchYourPlot.aspx" "RoRView.aspx"; do
  echo ""
  echo "Checking $PAGE..."
  STATUS=$(curl -sL \
    -o /tmp/bhulekh_${PAGE%.aspx}.html \
    -w "%{http_code}" \
    --max-time 10 \
    -H "User-Agent: Mozilla/5.0" \
    "https://bhulekh.ori.nic.in/$PAGE")
  echo "  Status: $STATUS, Size: $(wc -c < /tmp/bhulekh_${PAGE%.aspx}.html 2>/dev/null || echo 0) bytes"
  if grep -q "ddlDistrict" /tmp/bhulekh_${PAGE%.aspx}.html 2>/dev/null; then
    echo "  ★ Has district dropdown"
  fi
  if grep -q "ddlVillage" /tmp/bhulekh_${PAGE%.aspx}.html 2>/dev/null; then
    echo "  ★ Has village dropdown"
  fi
  if grep -q "UniqueId\|uniqueId\|unique_id\|PlotId" /tmp/bhulekh_${PAGE%.aspx}.html 2>/dev/null; then
    echo "  ★ Has plot ID field"
  fi
done

# Cleanup
rm -f "$COOKIES" "$HEADERS_OUT"
echo ""
echo "=== Done ==="