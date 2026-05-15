#!/bin/bash
set -e

KEYSTORE_FILE="app/arvelli-release.keystore"
PROPERTIES_FILE="keystore.properties"

if [ -f "$KEYSTORE_FILE" ]; then
  echo "Release keystore already exists at $KEYSTORE_FILE"
  echo "Delete it first if you want to regenerate."
  exit 1
fi

echo "=== Arvelli Release Key Setup ==="
echo ""

read -p "Key alias (default: arvelli-key): " KEY_ALIAS
KEY_ALIAS=${KEY_ALIAS:-arvelli-key}

read -sp "Keystore password (min 6 chars): " STORE_PASSWORD
echo ""
read -sp "Confirm keystore password: " STORE_PASSWORD_CONFIRM
echo ""

if [ "$STORE_PASSWORD" != "$STORE_PASSWORD_CONFIRM" ]; then
  echo "ERROR: Passwords do not match."
  exit 1
fi

if [ ${#STORE_PASSWORD} -lt 6 ]; then
  echo "ERROR: Password must be at least 6 characters."
  exit 1
fi

read -sp "Key password (press Enter to use same as keystore): " KEY_PASSWORD
echo ""
KEY_PASSWORD=${KEY_PASSWORD:-$STORE_PASSWORD}

echo ""
echo "--- Certificate details ---"
read -p "Your name (CN): " CN
read -p "Organization (O): " ORG
read -p "City/Locality (L): " CITY
read -p "State (ST): " STATE
read -p "Country code, 2 letters (C): " COUNTRY

DNAME="CN=$CN, O=$ORG, L=$CITY, ST=$STATE, C=$COUNTRY"

echo ""
echo "Generating release keystore..."

keytool -genkeypair \
  -v \
  -storetype PKCS12 \
  -keystore "$KEYSTORE_FILE" \
  -alias "$KEY_ALIAS" \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -storepass "$STORE_PASSWORD" \
  -keypass "$KEY_PASSWORD" \
  -dname "$DNAME"

echo ""
echo "Keystore created at: $KEYSTORE_FILE"

cat > "$PROPERTIES_FILE" <<EOF
ARVELLI_RELEASE_STORE_FILE=arvelli-release.keystore
ARVELLI_RELEASE_KEY_ALIAS=$KEY_ALIAS
ARVELLI_RELEASE_STORE_PASSWORD=$STORE_PASSWORD
ARVELLI_RELEASE_KEY_PASSWORD=$KEY_PASSWORD
EOF

echo "Credentials saved to: $PROPERTIES_FILE"
echo ""
echo "=== Done! ==="
echo ""
echo "You can now build a release APK:"
echo "  cd android && ./gradlew assembleRelease"
echo ""
echo "Or a release AAB (for Play Store):"
echo "  cd android && ./gradlew bundleRelease"
echo ""
echo "IMPORTANT: Keep $PROPERTIES_FILE and $KEYSTORE_FILE safe and backed up!"
echo "           If you lose them, you cannot update your app on the Play Store."
