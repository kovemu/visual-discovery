import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(request: NextRequest) {
  try {
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Supabase server configuration is missing." },
        { status: 500 }
      );
    }

    const body = await request.json();

    const name = body.name?.trim();
    const username = body.username?.trim();
    const category = body.category?.trim();

    if (!name) {
      return NextResponse.json(
        { error: "Artist name is required." },
        { status: 400 }
      );
    }

    if (!category) {
      return NextResponse.json(
        { error: "Category is required." },
        { status: 400 }
      );
    }

    const supabaseAdmin = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const { data, error } = await supabaseAdmin
      .from("creators")
      .insert({
        name,
        username: username || null,
        category,
      })
      .select("id, name, username")
      .single();

    if (error) {
      console.error("CREATE ARTIST API ERROR:", error);

      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      artist: data,
    });
  } catch (error) {
    console.error("CREATE ARTIST SERVER ERROR:", error);

    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 }
    );
  }
}