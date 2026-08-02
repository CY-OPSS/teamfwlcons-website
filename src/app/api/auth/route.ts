import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    // Redirect to GitHub OAuth
    const clientId = process.env.GITHUB_ID;
    const redirectUri = `${process.env.NEXTAUTH_URL}/api/auth?provider=github`;
    const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=repo,user`;
    return NextResponse.redirect(githubAuthUrl);
  }

  // Exchange code for token
  const clientId = process.env.GITHUB_ID;
  const clientSecret = process.env.GITHUB_SECRET;

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
    return NextResponse.json(tokenData, { status: 400 });
  }

  // Return the token in a format Decap CMS understands
  const html = `
    <!DOCTYPE html>
    <html>
    <body>
      <script>
        const message = {
          token: "${tokenData.access_token}",
          provider: "github"
        };
        window.opener.postMessage(
          "authorization:github:success:" + JSON.stringify(message),
          window.location.origin
        );
        window.close();
      </script>
    </body>
    </html>
  `;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html" },
  });
}
