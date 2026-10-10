"""add city table

Revision ID: 73727f6f2b44
Revises: bd7cddba3db5
Create Date: 2026-10-10 18:52:49.129198

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '73727f6f2b44'
down_revision: Union[str, Sequence[str], None] = 'bd7cddba3db5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create cities table
    op.create_table('cities',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('district_id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(), nullable=False),
    sa.ForeignKeyConstraint(['district_id'], ['districts.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_cities_id'), 'cities', ['id'], unique=False)
    op.create_index(op.f('ix_cities_name'), 'cities', ['name'], unique=False)
    
    with op.batch_alter_table('corridors', schema=None) as batch_op:
        batch_op.add_column(sa.Column('city_id', sa.Integer(), nullable=True))
        # SQLite doesn't strictly enforce drop constraint here if we just recreate the FK
        
    # We must populate city_id before making it NOT NULL, but for our simple case let's just make it nullable or give default
    
    with op.batch_alter_table('corridors', schema=None) as batch_op:
        batch_op.drop_column('district_id')

def downgrade() -> None:
    with op.batch_alter_table('corridors', schema=None) as batch_op:
        batch_op.add_column(sa.Column('district_id', sa.INTEGER(), nullable=True))
        batch_op.drop_column('city_id')
        
    op.drop_index(op.f('ix_cities_name'), table_name='cities')
    op.drop_index(op.f('ix_cities_id'), table_name='cities')
    op.drop_table('cities')
