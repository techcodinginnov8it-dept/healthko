const { PrismaClient } = require("@prisma/client");

async function main() {
  const prisma = new PrismaClient();
  console.log("Connecting to the database to install Supabase-Prisma synchronization triggers...");

  try {
    // 1. Trigger for auth.users -> public.patients & public.doctors
    console.log("Installing tr_sync_supabase_to_prisma trigger...");
    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION public.sync_supabase_to_prisma()
      RETURNS TRIGGER AS $$
      BEGIN
        IF TG_OP = 'DELETE' THEN
          DELETE FROM public.patients WHERE email = OLD.email;
          DELETE FROM public.doctors WHERE email = OLD.email;
          RETURN OLD;
        ELSIF TG_OP = 'UPDATE' THEN
          -- Sync email
          IF OLD.email IS DISTINCT FROM NEW.email THEN
            UPDATE public.patients SET email = NEW.email WHERE email = OLD.email;
            UPDATE public.doctors SET email = NEW.email WHERE email = OLD.email;
          END IF;
          
          -- Sync firstName and lastName for patients if raw_user_meta_data has them
          IF NEW.raw_user_meta_data ? 'first_name' AND NEW.raw_user_meta_data->>'first_name' IS NOT NULL THEN
            UPDATE public.patients 
            SET "firstName" = NEW.raw_user_meta_data->>'first_name'
            WHERE email = NEW.email;
          END IF;
          IF NEW.raw_user_meta_data ? 'last_name' AND NEW.raw_user_meta_data->>'last_name' IS NOT NULL THEN
            UPDATE public.patients 
            SET "lastName" = NEW.raw_user_meta_data->>'last_name'
            WHERE email = NEW.email;
          END IF;
          
          RETURN NEW;
        END IF;
        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `);

    await prisma.$executeRawUnsafe(`
      DROP TRIGGER IF EXISTS tr_sync_supabase_to_prisma ON auth.users;
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER tr_sync_supabase_to_prisma
        AFTER UPDATE OR DELETE ON auth.users
        FOR EACH ROW
        EXECUTE FUNCTION public.sync_supabase_to_prisma();
    `);

    // 2. Trigger for public.patients -> auth.users
    console.log("Installing tr_sync_patients_to_supabase trigger...");
    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION public.sync_patients_to_supabase()
      RETURNS TRIGGER AS $$
      BEGIN
        IF TG_OP = 'DELETE' THEN
          DELETE FROM auth.users WHERE email = OLD.email;
          RETURN OLD;
        ELSIF TG_OP = 'UPDATE' THEN
          -- Sync email
          IF OLD.email IS DISTINCT FROM NEW.email THEN
            UPDATE auth.users SET email = NEW.email, email_change_confirm_status = 0 WHERE email = OLD.email;
          END IF;
          
          -- Sync metadata (first_name, last_name)
          IF OLD."firstName" IS DISTINCT FROM NEW."firstName" OR OLD."lastName" IS DISTINCT FROM NEW."lastName" THEN
            UPDATE auth.users 
            SET raw_user_meta_data = 
              coalesce(raw_user_meta_data, '{}'::jsonb) || 
              jsonb_build_object('first_name', NEW."firstName", 'last_name', NEW."lastName")
            WHERE email = NEW.email;
          END IF;
          
          RETURN NEW;
        END IF;
        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `);

    await prisma.$executeRawUnsafe(`
      DROP TRIGGER IF EXISTS tr_sync_patients_to_supabase ON public.patients;
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER tr_sync_patients_to_supabase
        AFTER UPDATE OR DELETE ON public.patients
        FOR EACH ROW
        EXECUTE FUNCTION public.sync_patients_to_supabase();
    `);

    // 3. Trigger for public.doctors -> auth.users
    console.log("Installing tr_sync_doctors_to_supabase trigger...");
    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION public.sync_doctors_to_supabase()
      RETURNS TRIGGER AS $$
      BEGIN
        IF TG_OP = 'DELETE' THEN
          DELETE FROM auth.users WHERE email = OLD.email;
          RETURN OLD;
        ELSIF TG_OP = 'UPDATE' THEN
          -- Sync email
          IF OLD.email IS DISTINCT FROM NEW.email THEN
            UPDATE auth.users SET email = NEW.email, email_change_confirm_status = 0 WHERE email = OLD.email;
          END IF;
          
          -- Sync name
          IF OLD.name IS DISTINCT FROM NEW.name THEN
            UPDATE auth.users 
            SET raw_user_meta_data = 
              coalesce(raw_user_meta_data, '{}'::jsonb) || 
              jsonb_build_object('first_name', NEW.name)
            WHERE email = NEW.email;
          END IF;
          
          RETURN NEW;
        END IF;
        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `);

    await prisma.$executeRawUnsafe(`
      DROP TRIGGER IF EXISTS tr_sync_doctors_to_supabase ON public.doctors;
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER tr_sync_doctors_to_supabase
        AFTER UPDATE OR DELETE ON public.doctors
        FOR EACH ROW
        EXECUTE FUNCTION public.sync_doctors_to_supabase();
    `);

    console.log("✅ Database synchronization triggers installed successfully!");
  } catch (error) {
    console.error("❌ Failed to install triggers:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
