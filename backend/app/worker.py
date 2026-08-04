import asyncio

from app.services.ai_worker import run_worker


async def main() -> None:
    await run_worker(asyncio.Event())


if __name__ == "__main__":
    asyncio.run(main())
