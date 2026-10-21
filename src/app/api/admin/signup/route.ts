import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";

const VALID_ROLES = ["head_campaign", "campaign_manager", "va", "discord_mod", "freelance"];

export async function POST(req: NextRequest) {
  const { name, email, password, inviteCode, teamRole } = await req.json();

  if (!name?.trim() || !email?.trim() || !password || !inviteCode) {
    return NextResponse.json({ error: "All fields are required" }, { status: 400 });
  }
  if (!teamRole || !VALID_ROLES.includes(teamRole)) {
    return NextResponse.json({ error: "Please select your role" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }

  // Validate invite code
  const setting = await prisma.siteSetting.findUnique({ where: { key: "admin_invite_code" } });
  if (!setting?.value) {
    return NextResponse.json({ error: "No invite code has been set. Contact your agency admin." }, { status: 403 });
  }
  if (setting.value.trim() !== inviteCode.trim()) {
    return NextResponse.json({ error: "Invalid invite code" }, { status: 403 });
  }

  // Check email not already taken
  const existing = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (existing) {
    return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      passwordHash,
      role: "agency",
      mustChangePassword: false,
      isTeamMember: true,
      teamRole,
    },
    select: { id: true, name: true, email: true, role: true },
  });

  return NextResponse.json(user, { status: 201 });
}
