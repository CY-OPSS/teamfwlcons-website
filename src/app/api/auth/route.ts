import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  // If no code, this is the initial request from CMS - redirect to GitHub
  if (!code) {
    const clientId = process.env.GITHUB_ID;
    const siteUrl = process.env.NEXTAUTH_URL || "https://teamfwlcons-website.vercel.app";
    const redirectUri = `${siteUrl}/api/auth`;
    const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=repo,user`;
    return NextResponse.redirect(githubAuthUrl);
  }

  // Exchange code for token
  const clientId = process.env.GITHUB_ID;
  const clientSecret = process.env.GITHUB_SECRET;

  try {
    const tokenResponse = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
        }),
      }
    );

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      const errorHtml = `
        <!DOCTYPE html>
        <html>
        <body>
          <script>
            window.opener.postMessage(
              "authorization:github:error:${tokenData.error_description || tokenData.error}",
              window.location.origin
            );
            window.close();
          </script>
        </body>
        </html>
      `;
      return new NextResponse(errorHtml, {
        headers: { "Content-Type": "text/html" },
      });
    }

    // Return the token in a format Decap CMS understands
    const successHtml = `
      <!DOCTYPE html>
      <html>
      <body>
        <script>
          (function() {
            function sendMessage() {
              var message = "authorization:github:success:" + JSON.stringify({
                token: "${tokenData.access_token}",
                provider: "github"
              });
              if (window.opener) {
                window.opener.postMessage(message, window.location.origin);
                window.close();
              }
            }
            sendMessage();
          })();
        </script>
      </body>
      </html>
    `;

    return new NextResponse(successHtml, {
      headers: { "Content-Type": "text/html" },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to exchange code for token" },
      { status: 500 }
    );
  }
}
